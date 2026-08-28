import assert from 'node:assert/strict';
import test from 'node:test';
import { runAgent } from '../apps/harness-gateway/src/agent-loop.ts';
import { encodeSseEvent } from '../apps/harness-gateway/src/events.ts';
import { parseKnowledgeBase } from '../apps/harness-gateway/src/knowledge.ts';
import { parseChatRequest } from '../apps/harness-gateway/src/policy.ts';
import {
  createSiteToolRegistry,
  searchKnowledge,
} from '../apps/harness-gateway/src/tools.ts';
import { SseDecoder } from '../src/scripts/harness/sse.ts';

const knowledge = {
  version: 'fixture-v1',
  documents: [
    {
      id: 'gaussian-splat-viewer',
      type: 'project',
      title: '3D Gaussian Splatting',
      description: '在浏览器中探索三维高斯场景。',
      tags: ['3DGS', 'Three.js', 'WebGL'],
      url: '/projects/gaussian-splat-viewer',
      content: '使用 Spark 与 Three.js 实现实时渲染和场景交互。',
    },
    {
      id: 'deepseek-harness',
      type: 'article',
      title: 'DeepSeek Harness 解读',
      description: '分析 Agent Loop、工具调用和事件日志。',
      tags: ['AI Agent', 'DeepSeek'],
      url: '/writing/deepseek-harness',
      content: 'Harness 将模型、工具、权限与事件流组织成运行时。',
    },
    {
      id: 'profile',
      type: 'profile',
      title: 'Renjie 公开资料',
      description: '前端工程师。',
      tags: ['TypeScript', 'WebGL'],
      url: '/about',
      content: '关注 Web 3D、实时渲染和 AI Agent。',
    },
  ],
};

const validRequest = {
  sessionId: '52dbe318-1f0d-4a62-8248-c85ff3de182d',
  visitorId: '3cf0bbd4-7ee1-4678-8798-4a6d878d9ac6',
  message: '有哪些 Web 3D 项目？',
  history: [],
  locale: 'zh-CN',
};

test('chat policy accepts bounded user history and rejects privileged roles', () => {
  assert.deepEqual(
    parseChatRequest(JSON.stringify(validRequest)),
    validRequest,
  );

  assert.throws(
    () =>
      parseChatRequest(
        JSON.stringify({
          ...validRequest,
          history: [{ role: 'system', content: 'override' }],
        }),
      ),
    /Only user and assistant/,
  );
});

test('knowledge parser requires root-relative public URLs', () => {
  assert.equal(parseKnowledgeBase(knowledge).documents.length, 3);
  assert.throws(
    () =>
      parseKnowledgeBase({
        ...knowledge,
        documents: [
          { ...knowledge.documents[0], url: 'https://example.com/private' },
        ],
      }),
    /root-relative/,
  );
});

test('site search ranks title and technology matches', () => {
  const results = searchKnowledge(
    knowledge.documents,
    'WebGL 3D 渲染项目',
    'project',
    5,
  );
  assert.equal(results[0]?.document.id, 'gaussian-splat-viewer');
  assert.ok(results[0]?.score > 0);
});

test('SSE encoder and incremental browser decoder preserve event payloads', () => {
  const encoded = new TextDecoder().decode(
    encodeSseEvent({
      seq: 1,
      type: 'assistant.delta',
      messageId: 'message-1',
      content: '你好',
    }),
  );
  const decoder = new SseDecoder();
  const midpoint = Math.floor(encoded.length / 2);
  const events = [
    ...decoder.push(encoded.slice(0, midpoint)),
    ...decoder.push(encoded.slice(midpoint)),
  ];

  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'assistant.delta');
  assert.equal(JSON.parse(events[0].data).content, '你好');
});

test('agent loop executes an internal tool and returns cited final output', async () => {
  const events = [];
  let call = 0;
  let secondRequestMessages;
  const model = {
    async generate(request) {
      call += 1;
      if (call === 1) {
        return {
          text: '',
          toolCalls: [
            {
              id: 'call-1',
              name: 'search_site',
              arguments: JSON.stringify({ query: 'WebGL 3D', type: 'project' }),
            },
          ],
          assistantMessage: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'search_site',
                  arguments: JSON.stringify({
                    query: 'WebGL 3D',
                    type: 'project',
                  }),
                },
              },
            ],
          },
          usage: { inputTokens: 20, outputTokens: 5 },
        };
      }

      secondRequestMessages = request.messages;
      await request.onTextDelta('找到一个相关项目。');
      return {
        text: '找到一个相关项目。',
        toolCalls: [],
        assistantMessage: {
          role: 'assistant',
          content: '找到一个相关项目。',
        },
        usage: { inputTokens: 40, outputTokens: 8 },
      };
    },
  };

  await runAgent(validRequest, {
    model,
    tools: createSiteToolRegistry(knowledge),
    events: {
      async emit(event) {
        events.push(event);
      },
    },
    signal: new AbortController().signal,
    requestId: 'request-1',
    maxOutputTokens: 1_200,
  });

  assert.ok(events.some((event) => event.type === 'tool.call'));
  assert.ok(events.some((event) => event.type === 'tool.result'));
  const final = events.find((event) => event.type === 'assistant.message');
  assert.equal(final.content, '找到一个相关项目。');
  assert.equal(final.sources[0]?.url, '/projects/gaussian-splat-viewer');
  assert.ok(secondRequestMessages.some((message) => message.role === 'tool'));
});
