export type PublicDocumentType = 'article' | 'project' | 'profile';

export interface KnowledgeDocument {
  id: string;
  type: PublicDocumentType;
  title: string;
  description: string;
  tags: string[];
  url: string;
  content: string;
}

export interface KnowledgeBase {
  version: string;
  documents: KnowledgeDocument[];
}

export interface PublicSource {
  id: string;
  type: PublicDocumentType;
  title: string;
  url: string;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  sessionId: string;
  visitorId: string;
  message: string;
  history: ChatHistoryMessage[];
  locale: 'zh-CN' | 'en';
}

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface WorkerEnv {
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_API_URL: string;
  DEEPSEEK_MODEL: string;
  ALLOWED_ORIGINS: string;
  KNOWLEDGE_URL: string;
  MAX_OUTPUT_TOKENS: string;
  MAX_TURN_MS: string;
  VISITOR_RATE_LIMITER?: RateLimitBinding;
  NETWORK_RATE_LIMITER?: RateLimitBinding;
}

export interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export type HarnessEvent =
  | {
      seq: number;
      type: 'turn.start';
      turnId: string;
      createdAt: number;
    }
  | {
      seq: number;
      type: 'assistant.status';
      status: 'thinking' | 'using-tool' | 'answering';
      label?: string;
    }
  | {
      seq: number;
      type: 'assistant.delta';
      messageId: string;
      content: string;
    }
  | {
      seq: number;
      type: 'assistant.message';
      messageId: string;
      content: string;
      sources: PublicSource[];
    }
  | {
      seq: number;
      type: 'tool.call';
      callId: string;
      name: string;
      arguments: unknown;
    }
  | {
      seq: number;
      type: 'tool.result';
      callId: string;
      name: string;
      result: unknown;
      isError: boolean;
    }
  | {
      seq: number;
      type: 'turn.end';
      reason: 'completed' | 'error' | 'aborted' | 'max-steps';
      usage?: {
        inputTokens: number;
        outputTokens: number;
      };
    }
  | {
      seq: number;
      type: 'error';
      code: string;
      message: string;
      requestId?: string;
    };

export type HarnessEventInput = HarnessEvent extends infer Event
  ? Event extends { seq: number }
    ? Omit<Event, 'seq'>
    : never
  : never;

export interface ModelToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}

export type ModelMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ApiToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ApiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ModelResponse {
  text: string;
  toolCalls: ModelToolCall[];
  assistantMessage: Extract<ModelMessage, { role: 'assistant' }>;
  usage: ModelUsage;
}

export interface ModelRequest {
  messages: ModelMessage[];
  tools: ToolSchema[];
  signal: AbortSignal;
  maxOutputTokens: number;
  onTextDelta(content: string): Promise<void>;
}

export interface ModelAdapter {
  generate(request: ModelRequest): Promise<ModelResponse>;
}

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
