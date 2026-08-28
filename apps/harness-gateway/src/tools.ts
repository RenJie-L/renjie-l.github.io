import type {
  KnowledgeBase,
  KnowledgeDocument,
  ModelToolCall,
  PublicDocumentType,
  PublicSource,
  ToolSchema,
} from './types.ts';
import { isRecord } from './policy.ts';

const TOOL_TIMEOUT_MS = 3_000;
const HAN_STOP_WORDS = new Set([
  '哪些',
  '什么',
  '怎么',
  '如何',
  '相关',
  '项目',
  '文章',
  '可以',
  '一下',
  '这个',
  '那个',
  '主要',
  '有关',
]);

export interface ToolExecution {
  result: unknown;
  sources: PublicSource[];
}

interface ToolContext {
  knowledge: KnowledgeBase;
  signal: AbortSignal;
}

interface ToolDefinition {
  schema: ToolSchema;
  validate(value: unknown): unknown;
  execute(args: unknown, context: ToolContext): Promise<ToolExecution>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly knowledge: KnowledgeBase;

  constructor(knowledge: KnowledgeBase) {
    this.knowledge = knowledge;
  }

  register(definition: ToolDefinition): void {
    const name = definition.schema.function.name;
    if (this.tools.has(name))
      throw new Error(`Tool already registered: ${name}`);
    this.tools.set(name, definition);
  }

  schemas(): ToolSchema[] {
    return [...this.tools.values()].map((tool) => tool.schema);
  }

  parseArguments(call: ModelToolCall): unknown {
    try {
      return JSON.parse(call.arguments || '{}') as unknown;
    } catch {
      throw new Error(`Tool ${call.name} received invalid JSON arguments.`);
    }
  }

  async execute(
    call: ModelToolCall,
    parsedArguments: unknown,
    signal: AbortSignal,
  ): Promise<ToolExecution> {
    const tool = this.tools.get(call.name);
    if (!tool) throw new Error(`Unknown tool: ${call.name}`);

    const args = tool.validate(parsedArguments);
    return withTimeout(
      tool.execute(args, { knowledge: this.knowledge, signal }),
      signal,
      TOOL_TIMEOUT_MS,
    );
  }
}

export function createSiteToolRegistry(knowledge: KnowledgeBase): ToolRegistry {
  const registry = new ToolRegistry(knowledge);
  registry.register(searchSiteTool);
  registry.register(readArticleTool);
  registry.register(getProjectTool);
  registry.register(getProfileTool);
  return registry;
}

const searchSiteTool: ToolDefinition = {
  schema: {
    type: 'function',
    function: {
      name: 'search_site',
      description:
        'Search the public personal site for relevant articles, projects, and profile information. Use this before reading a specific item.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'A concise search query containing the important terms.',
          },
          type: {
            type: 'string',
            enum: ['all', 'article', 'project', 'profile'],
            description: 'Optionally restrict the result type.',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 5,
            description: 'Maximum number of results. Defaults to 5.',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  validate(value) {
    const args = requireObject(value);
    const query = requireNonEmptyString(args.query, 'query', 200);
    const type = parseSearchType(args.type);
    const limit = parseLimit(args.limit);
    return { query, type, limit };
  },
  async execute(value, context) {
    const args = value as {
      query: string;
      type: PublicDocumentType | 'all';
      limit: number;
    };
    const items = searchKnowledge(
      context.knowledge.documents,
      args.query,
      args.type,
      args.limit,
    );
    return {
      result: {
        query: args.query,
        count: items.length,
        items: items.map(({ document, score }) => ({
          id: document.id,
          type: document.type,
          title: document.title,
          description: document.description,
          tags: document.tags,
          url: document.url,
          relevance: Math.round(score * 10) / 10,
          snippet: buildSnippet(document.content, queryTerms(args.query)),
        })),
      },
      sources: items.map(({ document }) => toSource(document)),
    };
  },
};

const readArticleTool: ToolDefinition = {
  schema: {
    type: 'function',
    function: {
      name: 'read_article',
      description:
        'Read a public article by the exact article id returned by search_site.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Exact article id returned by search_site.',
          },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  validate(value) {
    const args = requireObject(value);
    return { id: requireNonEmptyString(args.id, 'id', 160) };
  },
  async execute(value, context) {
    const { id } = value as { id: string };
    const document = findDocument(context.knowledge, id, 'article');
    return {
      result: {
        id: document.id,
        title: document.title,
        description: document.description,
        tags: document.tags,
        url: document.url,
        content: truncate(document.content, 12_000),
      },
      sources: [toSource(document)],
    };
  },
};

const getProjectTool: ToolDefinition = {
  schema: {
    type: 'function',
    function: {
      name: 'get_project',
      description:
        'Read a public project by the exact project id returned by search_site.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Exact project id returned by search_site.',
          },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  validate(value) {
    const args = requireObject(value);
    return { id: requireNonEmptyString(args.id, 'id', 160) };
  },
  async execute(value, context) {
    const { id } = value as { id: string };
    const document = findDocument(context.knowledge, id, 'project');
    return {
      result: {
        id: document.id,
        title: document.title,
        description: document.description,
        technologies: document.tags,
        url: document.url,
        details: truncate(document.content, 8_000),
      },
      sources: [toSource(document)],
    };
  },
};

const getProfileTool: ToolDefinition = {
  schema: {
    type: 'function',
    function: {
      name: 'get_profile',
      description:
        'Read the public profile and technical focus shown on the personal site.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  validate(value) {
    const args = requireObject(value);
    if (Object.keys(args).length > 0) {
      throw new Error('get_profile does not accept arguments.');
    }
    return {};
  },
  async execute(_value, context) {
    const document = context.knowledge.documents.find(
      (item) => item.type === 'profile',
    );
    if (!document) throw new Error('Public profile is unavailable.');
    return {
      result: {
        title: document.title,
        description: document.description,
        focus: document.tags,
        url: document.url,
        content: truncate(document.content, 4_000),
      },
      sources: [toSource(document)],
    };
  },
};

export function searchKnowledge(
  documents: KnowledgeDocument[],
  query: string,
  type: PublicDocumentType | 'all' = 'all',
  limit = 5,
): Array<{ document: KnowledgeDocument; score: number }> {
  const normalizedQuery = normalize(query);
  const terms = queryTerms(query);

  return documents
    .filter((document) => type === 'all' || document.type === type)
    .map((document) => ({
      document,
      score: scoreDocument(document, normalizedQuery, terms),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.document.title.localeCompare(right.document.title),
    )
    .slice(0, limit);
}

function scoreDocument(
  document: KnowledgeDocument,
  normalizedQuery: string,
  terms: string[],
): number {
  const title = normalize(document.title);
  const tags = normalize(document.tags.join(' '));
  const description = normalize(document.description);
  const content = normalize(document.content);
  let score = 0;

  if (normalizedQuery.length >= 2) {
    if (title.includes(normalizedQuery)) score += 24;
    if (tags.includes(normalizedQuery)) score += 14;
    if (description.includes(normalizedQuery)) score += 9;
    if (content.includes(normalizedQuery)) score += 3;
  }

  for (const term of terms) {
    if (title.includes(term)) score += 8;
    if (tags.includes(term)) score += 5;
    if (description.includes(term)) score += 3;
    if (content.includes(term)) score += 1;
  }
  return score;
}

function queryTerms(query: string): string[] {
  const normalized = normalize(query);
  const terms = new Set<string>();

  for (const token of normalized.match(/[a-z0-9][a-z0-9.+#-]*/g) ?? []) {
    if (token.length >= 2) terms.add(token);
  }

  for (const run of normalized.match(/[\p{Script=Han}]{2,}/gu) ?? []) {
    if (run.length <= 4 && !HAN_STOP_WORDS.has(run)) terms.add(run);
    for (let index = 0; index < run.length - 1; index++) {
      const bigram = run.slice(index, index + 2);
      if (!HAN_STOP_WORDS.has(bigram)) terms.add(bigram);
    }
  }

  return [...terms].slice(0, 20);
}

function buildSnippet(content: string, terms: string[]): string {
  const plain = stripMarkdown(content);
  const normalized = normalize(plain);
  const firstMatch = terms
    .map((term) => normalized.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const start = firstMatch === undefined ? 0 : Math.max(0, firstMatch - 80);
  const prefix = start > 0 ? '…' : '';
  const suffix = start + 320 < plain.length ? '…' : '';
  return `${prefix}${plain.slice(start, start + 320).trim()}${suffix}`;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

function findDocument(
  knowledge: KnowledgeBase,
  id: string,
  type: PublicDocumentType,
): KnowledgeDocument {
  const document = knowledge.documents.find(
    (item) => item.id === id && item.type === type,
  );
  if (!document) throw new Error(`${type} not found: ${id}`);
  return document;
}

function toSource(document: KnowledgeDocument): PublicSource {
  return {
    id: document.id,
    type: document.type,
    title: document.title,
    url: document.url,
  };
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Tool arguments must be an object.');
  return value;
}

function requireNonEmptyString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new Error(`${field} cannot exceed ${maxLength} characters.`);
  }
  return text;
}

function parseSearchType(value: unknown): PublicDocumentType | 'all' {
  if (value === undefined || value === 'all') return 'all';
  if (value === 'article' || value === 'project' || value === 'profile') {
    return value;
  }
  throw new Error('type must be all, article, project, or profile.');
}

function parseLimit(value: unknown): number {
  if (value === undefined) return 5;
  if (
    !Number.isInteger(value) ||
    (value as number) < 1 ||
    (value as number) > 5
  ) {
    throw new Error('limit must be an integer between 1 and 5.');
  }
  return value as number;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength)}\n\n[Content truncated]`;
}

function withTimeout<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Tool execution was aborted.'));
      return;
    }

    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      callback();
    };
    const timeout = setTimeout(
      () => finish(() => reject(new Error('Tool execution timed out.'))),
      timeoutMs,
    );
    const abort = () =>
      finish(() => reject(new Error('Tool execution was aborted.')));
    signal.addEventListener('abort', abort, { once: true });

    promise.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}
