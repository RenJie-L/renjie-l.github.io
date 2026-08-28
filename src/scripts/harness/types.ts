export type HarnessRole = 'user' | 'assistant';

export interface HarnessHistoryMessage {
  role: HarnessRole;
  content: string;
}

export interface HarnessSource {
  id: string;
  type: 'article' | 'project' | 'profile';
  title: string;
  url: string;
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
      sources: HarnessSource[];
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
