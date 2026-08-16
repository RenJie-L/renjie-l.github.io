import type { ChatHistoryMessage, ChatRequest, WorkerEnv } from './types.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_MESSAGE_LENGTH = 4_000;

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function allowedOrigins(env: WorkerEnv): Set<string> {
  return new Set(
    env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function assertAllowedOrigin(request: Request, env: WorkerEnv): void {
  const origin = request.headers.get('Origin');
  if (!origin) return;
  if (!allowedOrigins(env).has(origin)) {
    throw new HttpError(403, 'origin_not_allowed', 'Origin is not allowed.');
  }
}

export function corsHeaders(request: Request, env: WorkerEnv): Headers {
  const origins = allowedOrigins(env);
  const requestOrigin = request.headers.get('Origin');
  const origin =
    requestOrigin && origins.has(requestOrigin)
      ? requestOrigin
      : ([...origins][0] ?? 'https://renjie-l.github.io');

  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Accept,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
}

export function parseChatRequest(raw: string): ChatRequest {
  if (raw.length > 24_000) {
    throw new HttpError(413, 'request_too_large', 'Request body is too large.');
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new HttpError(
      400,
      'invalid_json',
      'Request body must be valid JSON.',
    );
  }

  if (!isRecord(value)) {
    throw new HttpError(
      400,
      'invalid_request',
      'Request body must be an object.',
    );
  }

  const sessionId = readUuid(value.sessionId, 'sessionId');
  const visitorId = readUuid(value.visitorId, 'visitorId');
  const message = readString(value.message, 'message').trim();
  if (!message) {
    throw new HttpError(400, 'empty_message', 'Message cannot be empty.');
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(
      400,
      'message_too_long',
      `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
    );
  }

  const historyValue = value.history ?? [];
  if (!Array.isArray(historyValue)) {
    throw new HttpError(400, 'invalid_history', 'History must be an array.');
  }
  if (historyValue.length > MAX_HISTORY_MESSAGES) {
    throw new HttpError(
      400,
      'history_too_long',
      `History cannot exceed ${MAX_HISTORY_MESSAGES} messages.`,
    );
  }

  const history = historyValue.map((item, index) =>
    parseHistoryMessage(item, index),
  );
  const locale = value.locale === 'en' ? 'en' : 'zh-CN';

  return { sessionId, visitorId, message, history, locale };
}

function parseHistoryMessage(
  value: unknown,
  index: number,
): ChatHistoryMessage {
  if (!isRecord(value)) {
    throw new HttpError(
      400,
      'invalid_history',
      `History item ${index} must be an object.`,
    );
  }
  if (value.role !== 'user' && value.role !== 'assistant') {
    throw new HttpError(
      400,
      'invalid_history_role',
      'Only user and assistant history messages are accepted.',
    );
  }

  const content = readString(value.content, `history[${index}].content`).trim();
  if (!content || content.length > MAX_HISTORY_MESSAGE_LENGTH) {
    throw new HttpError(
      400,
      'invalid_history_content',
      `History item ${index} has invalid content.`,
    );
  }

  return { role: value.role, content };
}

function readUuid(value: unknown, field: string): string {
  const text = readString(value, field);
  if (!UUID_PATTERN.test(text)) {
    throw new HttpError(400, 'invalid_identifier', `${field} must be a UUID.`);
  }
  return text;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'invalid_request', `${field} must be a string.`);
  }
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
