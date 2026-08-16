import { runAgent } from './agent-loop.ts';
import { DeepSeekAdapter } from './deepseek.ts';
import { SseEventSink } from './events.ts';
import { loadKnowledge } from './knowledge.ts';
import {
  assertAllowedOrigin,
  corsHeaders,
  HttpError,
  parseChatRequest,
} from './policy.ts';
import { createSiteToolRegistry } from './tools.ts';
import type {
  ChatRequest,
  WorkerEnv,
  WorkerExecutionContext,
} from './types.ts';

const DEFAULT_MAX_TURN_MS = 55_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1_200;

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    context: WorkerExecutionContext,
  ): Promise<Response> {
    const requestId = crypto.randomUUID();

    try {
      assertAllowedOrigin(request, env);
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(request, env),
        });
      }

      if (request.method === 'GET' && url.pathname === '/v1/health') {
        return jsonResponse(
          {
            status: 'ok',
            version: '1',
            model: env.DEEPSEEK_MODEL,
          },
          200,
          request,
          env,
        );
      }

      if (request.method === 'POST' && url.pathname === '/v1/chat') {
        return await handleChat(request, env, context, requestId);
      }

      throw new HttpError(404, 'not_found', 'Endpoint not found.');
    } catch (error) {
      const httpError =
        error instanceof HttpError
          ? error
          : new HttpError(500, 'internal_error', 'Unexpected gateway error.');
      if (!(error instanceof HttpError)) {
        console.error('Harness gateway error', requestId, error);
      }
      return jsonResponse(
        {
          error: {
            code: httpError.code,
            message: httpError.message,
            requestId,
          },
        },
        httpError.status,
        request,
        env,
      );
    }
  },
};

async function handleChat(
  request: Request,
  env: WorkerEnv,
  context: WorkerExecutionContext,
  requestId: string,
): Promise<Response> {
  assertJsonContentType(request);
  const declaredLength = Number(request.headers.get('Content-Length') ?? 0);
  if (declaredLength > 24_000) {
    throw new HttpError(413, 'request_too_large', 'Request body is too large.');
  }

  const input = parseChatRequest(await request.text());
  await enforceRateLimits(request, input, env);

  const timeoutMs = boundedInteger(
    env.MAX_TURN_MS,
    DEFAULT_MAX_TURN_MS,
    5_000,
    60_000,
  );
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  const abortFromRequest = () => abortController.abort();
  request.signal.addEventListener('abort', abortFromRequest, { once: true });

  let knowledge;
  try {
    knowledge = await loadKnowledge(env.KNOWLEDGE_URL, abortController.signal);
  } catch {
    clearTimeout(timeout);
    request.signal.removeEventListener('abort', abortFromRequest);
    throw new HttpError(
      502,
      'knowledge_unavailable',
      'Public site knowledge is temporarily unavailable.',
    );
  }

  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  const events = new SseEventSink(writer);
  const maxOutputTokens = boundedInteger(
    env.MAX_OUTPUT_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
    256,
    2_000,
  );

  const task = runAgent(input, {
    model: new DeepSeekAdapter(env),
    tools: createSiteToolRegistry(knowledge),
    events,
    signal: abortController.signal,
    requestId,
    maxOutputTokens,
  }).finally(async () => {
    clearTimeout(timeout);
    request.signal.removeEventListener('abort', abortFromRequest);
    try {
      await writer.close();
    } catch {
      // The browser may have cancelled the response stream.
    }
  });
  context.waitUntil(task);

  const headers = corsHeaders(request, env);
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Type', 'text/event-stream; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex');
  headers.set('X-Request-Id', requestId);

  return new Response(stream.readable, { status: 200, headers });
}

async function enforceRateLimits(
  request: Request,
  input: ChatRequest,
  env: WorkerEnv,
): Promise<void> {
  const checks: Array<Promise<{ success: boolean }>> = [];
  if (env.VISITOR_RATE_LIMITER) {
    checks.push(
      env.VISITOR_RATE_LIMITER.limit({ key: `visitor:${input.visitorId}` }),
    );
  }
  if (env.NETWORK_RATE_LIMITER) {
    const network = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    checks.push(env.NETWORK_RATE_LIMITER.limit({ key: `network:${network}` }));
  }

  const results = await Promise.all(checks);
  if (results.some((result) => !result.success)) {
    throw new HttpError(429, 'rate_limited', '请求过于频繁，请稍后再试。');
  }
}

function assertJsonContentType(request: Request): void {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError(
      415,
      'unsupported_media_type',
      'Content-Type must be application/json.',
    );
  }
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function jsonResponse(
  body: unknown,
  status: number,
  request: Request,
  env: WorkerEnv,
): Response {
  const headers = corsHeaders(request, env);
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(JSON.stringify(body), { status, headers });
}
