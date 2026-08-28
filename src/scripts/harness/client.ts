import { consumeSseStream } from './sse';
import type {
  HarnessEvent,
  HarnessHistoryMessage,
  HarnessSource,
} from './types';

const HISTORY_KEY = 'renjie:harness:history:v1';
const SESSION_KEY = 'renjie:harness:session:v1';
const VISITOR_KEY = 'renjie:harness:visitor:v1';
const MAX_HISTORY_MESSAGES = 10;

const toolLabels: Record<string, string> = {
  search_site: '搜索站内内容',
  read_article: '读取文章',
  get_project: '读取项目',
  get_profile: '读取公开资料',
};

function requiredElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing Harness element: ${selector}`);
  return element;
}

function loadHistory(): HarnessHistoryMessage[] {
  try {
    const parsed: unknown = JSON.parse(
      sessionStorage.getItem(HISTORY_KEY) ?? '[]',
    );
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is HarnessHistoryMessage =>
          typeof item === 'object' &&
          item !== null &&
          'role' in item &&
          (item.role === 'user' || item.role === 'assistant') &&
          'content' in item &&
          typeof item.content === 'string',
      )
      .slice(-MAX_HISTORY_MESSAGES);
  } catch {
    return [];
  }
}

function getSessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

function getVisitorId(): string {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(VISITOR_KEY, id);
  return id;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export class HarnessExperienceController {
  private readonly apiUrl: string;
  private readonly form: HTMLFormElement;
  private readonly input: HTMLTextAreaElement;
  private readonly submitButton: HTMLButtonElement;
  private readonly stopButton: HTMLButtonElement;
  private readonly clearButton: HTMLButtonElement;
  private readonly messageList: HTMLElement;
  private readonly traceList: HTMLElement;
  private readonly traceEmpty: HTMLElement;
  private readonly statusText: HTMLElement;
  private readonly statusDot: HTMLElement;
  private readonly quickPrompts: HTMLButtonElement[];
  private readonly toolCards = new Map<string, HTMLElement>();
  private history = loadHistory();
  private abortController?: AbortController;
  private destroyed = false;

  constructor(private readonly root: HTMLElement) {
    this.apiUrl = (root.dataset.apiUrl ?? '').replace(/\/$/, '');
    this.form = requiredElement(root, '[data-harness-form]');
    this.input = requiredElement(root, '[data-harness-input]');
    this.submitButton = requiredElement(root, '[data-harness-submit]');
    this.stopButton = requiredElement(root, '[data-harness-stop]');
    this.clearButton = requiredElement(root, '[data-harness-clear]');
    this.messageList = requiredElement(root, '[data-harness-messages]');
    this.traceList = requiredElement(root, '[data-harness-trace]');
    this.traceEmpty = requiredElement(root, '[data-harness-trace-empty]');
    this.statusText = requiredElement(root, '[data-harness-status-text]');
    this.statusDot = requiredElement(root, '[data-harness-status-dot]');
    this.quickPrompts = [
      ...root.querySelectorAll<HTMLButtonElement>('[data-harness-prompt]'),
    ];

    this.form.addEventListener('submit', this.handleSubmit);
    this.input.addEventListener('keydown', this.handleInputKeydown);
    this.input.addEventListener('input', this.resizeInput);
    this.stopButton.addEventListener('click', this.stop);
    this.clearButton.addEventListener('click', this.clearConversation);
    this.quickPrompts.forEach((button) =>
      button.addEventListener('click', this.handleQuickPrompt),
    );

    void this.checkHealth();
  }

  destroy(): void {
    this.destroyed = true;
    this.abortController?.abort();
    this.form.removeEventListener('submit', this.handleSubmit);
    this.input.removeEventListener('keydown', this.handleInputKeydown);
    this.input.removeEventListener('input', this.resizeInput);
    this.stopButton.removeEventListener('click', this.stop);
    this.clearButton.removeEventListener('click', this.clearConversation);
    this.quickPrompts.forEach((button) =>
      button.removeEventListener('click', this.handleQuickPrompt),
    );
  }

  private readonly checkHealth = async (): Promise<void> => {
    if (!this.apiUrl) {
      this.setStatus('offline', 'API 等待配置');
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/v1/health`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok)
        throw new Error(`Health check returned ${response.status}`);
      if (!this.destroyed) this.setStatus('ready', 'Agent 在线');
    } catch {
      if (!this.destroyed) this.setStatus('offline', 'Agent 暂时离线');
    }
  };

  private readonly handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const message = this.input.value.trim();
    if (!message || this.abortController) return;
    void this.send(message);
  };

  private readonly handleInputKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.form.requestSubmit();
    }
  };

  private readonly resizeInput = (): void => {
    this.input.style.height = 'auto';
    this.input.style.height = `${Math.min(this.input.scrollHeight, 144)}px`;
  };

  private readonly handleQuickPrompt = (event: Event): void => {
    const button = event.currentTarget as HTMLButtonElement;
    this.input.value = button.dataset.harnessPrompt ?? '';
    this.resizeInput();
    this.input.focus();
  };

  private readonly stop = (): void => {
    this.abortController?.abort();
  };

  private readonly clearConversation = (): void => {
    if (this.abortController) return;
    this.history = [];
    sessionStorage.removeItem(HISTORY_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    this.messageList
      .querySelectorAll('[data-dynamic-message]')
      .forEach((element) => element.remove());
    this.traceList
      .querySelectorAll('[data-tool-card]')
      .forEach((element) => element.remove());
    this.toolCards.clear();
    this.traceEmpty.hidden = false;
    this.setStatus(
      this.apiUrl ? 'ready' : 'offline',
      this.apiUrl ? 'Agent 在线' : 'API 等待配置',
    );
  };

  private async send(message: string): Promise<void> {
    if (!this.apiUrl) {
      this.appendError(
        'Harness Gateway 尚未配置。部署 Worker 后设置 PUBLIC_HARNESS_API_URL 即可连接。',
      );
      return;
    }

    const historyBeforeMessage = this.history.slice(-MAX_HISTORY_MESSAGES);
    this.history.push({ role: 'user', content: message });
    this.persistHistory();
    this.appendMessage('user', message, crypto.randomUUID());
    this.input.value = '';
    this.resizeInput();
    this.setBusy(true);
    this.setStatus('running', '正在理解问题');
    this.abortController = new AbortController();

    try {
      const response = await fetch(`${this.apiUrl}/v1/chat`, {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: getSessionId(),
          visitorId: getVisitorId(),
          message,
          history: historyBeforeMessage,
          locale: 'zh-CN',
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => undefined)) as
          { error?: { message?: string } } | undefined;
        throw new Error(
          payload?.error?.message ?? `Gateway returned ${response.status}`,
        );
      }

      await consumeSseStream(response, (decoded) => {
        const event = JSON.parse(decoded.data) as HarnessEvent;
        this.handleEvent(event);
      });
    } catch (error) {
      if (this.abortController.signal.aborted) {
        this.appendSystemNotice('本轮已停止。');
        this.setStatus('ready', '已停止');
      } else {
        const message = error instanceof Error ? error.message : '请求失败';
        this.appendError(message);
        this.setStatus('offline', '请求失败');
      }
    } finally {
      this.abortController = undefined;
      this.setBusy(false);
    }
  }

  private handleEvent(event: HarnessEvent): void {
    switch (event.type) {
      case 'turn.start':
        this.setStatus('running', 'Agent 运行中');
        break;
      case 'assistant.status':
        this.setStatus(
          'running',
          event.label ??
            (event.status === 'using-tool' ? '正在使用工具' : '正在生成回答'),
        );
        break;
      case 'assistant.delta':
        this.appendDelta(event.messageId, event.content);
        break;
      case 'assistant.message':
        this.finalizeAssistantMessage(
          event.messageId,
          event.content,
          event.sources,
        );
        this.history.push({ role: 'assistant', content: event.content });
        this.persistHistory();
        break;
      case 'tool.call':
        this.appendToolCall(event.callId, event.name, event.arguments);
        break;
      case 'tool.result':
        this.completeToolCall(event.callId, event.result, event.isError);
        break;
      case 'turn.end':
        this.setStatus(
          event.reason === 'completed' ? 'ready' : 'offline',
          event.reason === 'completed'
            ? '本轮完成'
            : `本轮结束：${event.reason}`,
        );
        break;
      case 'error':
        this.appendError(event.message);
        break;
    }
  }

  private appendMessage(
    role: 'user' | 'assistant',
    content: string,
    messageId: string,
  ): HTMLElement {
    const article = document.createElement('article');
    article.className = `harness-message ${role}`;
    article.dataset.dynamicMessage = '';
    article.dataset.messageId = messageId;

    const label = document.createElement('span');
    label.className = 'message-role';
    label.textContent = role === 'user' ? 'You' : 'Harness';

    const body = document.createElement('p');
    body.className = 'message-content';
    body.textContent = content;

    article.append(label, body);
    this.messageList.append(article);
    article.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return article;
  }

  private appendDelta(messageId: string, content: string): void {
    const selector = `[data-message-id="${CSS.escape(messageId)}"]`;
    const article =
      this.messageList.querySelector<HTMLElement>(selector) ??
      this.appendMessage('assistant', '', messageId);
    const body = requiredElement<HTMLElement>(article, '.message-content');
    body.textContent += content;
  }

  private finalizeAssistantMessage(
    messageId: string,
    content: string,
    sources: HarnessSource[],
  ): void {
    const selector = `[data-message-id="${CSS.escape(messageId)}"]`;
    const article =
      this.messageList.querySelector<HTMLElement>(selector) ??
      this.appendMessage('assistant', content, messageId);
    requiredElement<HTMLElement>(article, '.message-content').textContent =
      content;

    article.querySelector('.message-sources')?.remove();
    if (sources.length === 0) return;

    const list = document.createElement('div');
    list.className = 'message-sources';
    const label = document.createElement('span');
    label.textContent = '来源';
    list.append(label);

    for (const source of sources) {
      if (!source.url.startsWith('/')) continue;
      const link = document.createElement('a');
      link.href = source.url;
      link.textContent = source.title;
      list.append(link);
    }

    article.append(list);
  }

  private appendToolCall(callId: string, name: string, args: unknown): void {
    this.traceEmpty.hidden = true;
    const card = document.createElement('article');
    card.className = 'tool-card running';
    card.dataset.toolCard = '';
    card.dataset.callId = callId;

    const header = document.createElement('div');
    header.className = 'tool-card-head';
    const title = document.createElement('strong');
    title.textContent = toolLabels[name] ?? name;
    const state = document.createElement('span');
    state.dataset.toolState = '';
    state.textContent = '运行中';
    header.append(title, state);

    const argsBlock = document.createElement('pre');
    argsBlock.textContent = formatValue(args);
    card.append(header, argsBlock);
    this.traceList.append(card);
    this.toolCards.set(callId, card);
  }

  private completeToolCall(
    callId: string,
    result: unknown,
    isError: boolean,
  ): void {
    const card = this.toolCards.get(callId);
    if (!card) return;
    card.classList.remove('running');
    card.classList.toggle('failed', isError);
    const state = requiredElement<HTMLElement>(card, '[data-tool-state]');
    state.textContent = isError ? '失败' : '完成';

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '查看结果';
    const resultBlock = document.createElement('pre');
    resultBlock.textContent = formatValue(result);
    details.append(summary, resultBlock);
    card.append(details);
  }

  private appendError(message: string): void {
    const notice = document.createElement('p');
    notice.className = 'harness-notice error';
    notice.dataset.dynamicMessage = '';
    notice.textContent = message;
    this.messageList.append(notice);
    notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private appendSystemNotice(message: string): void {
    const notice = document.createElement('p');
    notice.className = 'harness-notice';
    notice.dataset.dynamicMessage = '';
    notice.textContent = message;
    this.messageList.append(notice);
  }

  private persistHistory(): void {
    this.history = this.history.slice(-MAX_HISTORY_MESSAGES);
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
  }

  private setBusy(busy: boolean): void {
    this.root.dataset.busy = String(busy);
    this.input.disabled = busy;
    this.submitButton.hidden = busy;
    this.stopButton.hidden = !busy;
    this.clearButton.disabled = busy;
  }

  private setStatus(
    state: 'ready' | 'running' | 'offline',
    text: string,
  ): void {
    this.root.dataset.status = state;
    this.statusDot.dataset.state = state;
    this.statusText.textContent = text;
  }
}
