import type {
  ApiToolCall,
  ModelAdapter,
  ModelRequest,
  ModelResponse,
  ModelToolCall,
  WorkerEnv,
} from './types.ts';

interface DeepSeekChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

export class DeepSeekAdapter implements ModelAdapter {
  private readonly env: WorkerEnv;

  constructor(env: WorkerEnv) {
    this.env = env;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const response = await fetch(this.env.DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.env.DEEPSEEK_MODEL,
        messages: request.messages,
        tools: request.tools,
        tool_choice: 'auto',
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: request.maxOutputTokens,
        temperature: 0.2,
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      throw new Error(
        `DeepSeek returned ${response.status}${details ? `: ${details}` : ''}`,
      );
    }
    if (!response.body) throw new Error('DeepSeek returned no response body.');

    const textParts: string[] = [];
    const toolCalls = new Map<number, ToolCallAccumulator>();
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const data of readSseData(response.body)) {
      if (data === '[DONE]') break;

      let chunk: DeepSeekChunk;
      try {
        chunk = JSON.parse(data) as DeepSeekChunk;
      } catch {
        throw new Error('DeepSeek returned an invalid streaming chunk.');
      }

      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
        outputTokens = chunk.usage.completion_tokens ?? outputTokens;
      }

      for (const choice of chunk.choices ?? []) {
        const content = choice.delta?.content;
        if (content) {
          textParts.push(content);
          await request.onTextDelta(content);
        }

        for (const delta of choice.delta?.tool_calls ?? []) {
          const current = toolCalls.get(delta.index) ?? {
            id: '',
            name: '',
            arguments: '',
          };
          if (delta.id) current.id = delta.id;
          if (delta.function?.name) current.name += delta.function.name;
          if (delta.function?.arguments) {
            current.arguments += delta.function.arguments;
          }
          toolCalls.set(delta.index, current);
        }
      }
    }

    const calls: ModelToolCall[] = [...toolCalls.entries()]
      .sort(([left], [right]) => left - right)
      .map(([index, call]) => ({
        id: call.id || `tool_${index}_${crypto.randomUUID()}`,
        name: call.name,
        arguments: call.arguments || '{}',
      }));
    const apiToolCalls: ApiToolCall[] = calls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: call.arguments },
    }));
    const text = textParts.join('');

    return {
      text,
      toolCalls: calls,
      assistantMessage: {
        role: 'assistant',
        content: text || null,
        ...(apiToolCalls.length > 0 ? { tool_calls: apiToolCalls } : {}),
      },
      usage: { inputTokens, outputTokens },
    };
  }
}

async function* readSseData(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replaceAll('\r\n', '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = extractData(block);
        if (data) yield data;
        boundary = buffer.indexOf('\n\n');
      }
    }

    buffer += decoder.decode();
    const data = extractData(buffer);
    if (data) yield data;
  } finally {
    reader.releaseLock();
  }
}

function extractData(block: string): string {
  return block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
}
