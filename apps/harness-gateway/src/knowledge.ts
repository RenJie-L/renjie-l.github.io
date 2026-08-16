import type {
  KnowledgeBase,
  KnowledgeDocument,
  PublicDocumentType,
} from './types.ts';
import { isRecord } from './policy.ts';

const CACHE_TTL_MS = 5 * 60 * 1_000;
let cached:
  { url: string; expiresAt: number; knowledge: KnowledgeBase } | undefined;

export async function loadKnowledge(
  url: string,
  signal?: AbortSignal,
): Promise<KnowledgeBase> {
  if (cached && cached.url === url && cached.expiresAt > Date.now()) {
    return cached.knowledge;
  }

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Knowledge index returned ${response.status}.`);
  }

  const value: unknown = await response.json();
  const knowledge = parseKnowledgeBase(value);
  cached = { url, expiresAt: Date.now() + CACHE_TTL_MS, knowledge };
  return knowledge;
}

export function parseKnowledgeBase(value: unknown): KnowledgeBase {
  if (!isRecord(value) || typeof value.version !== 'string') {
    throw new Error('Knowledge index has an invalid version.');
  }
  if (!Array.isArray(value.documents)) {
    throw new Error('Knowledge index documents must be an array.');
  }

  const documents = value.documents.map(parseDocument);
  return { version: value.version, documents };
}

function parseDocument(value: unknown): KnowledgeDocument {
  if (!isRecord(value))
    throw new Error('Knowledge document must be an object.');
  if (!isDocumentType(value.type)) {
    throw new Error('Knowledge document has an invalid type.');
  }
  if (!Array.isArray(value.tags) || !value.tags.every(isString)) {
    throw new Error('Knowledge document has invalid tags.');
  }

  const document: KnowledgeDocument = {
    id: requireString(value.id, 'id'),
    type: value.type,
    title: requireString(value.title, 'title'),
    description: requireString(value.description, 'description'),
    tags: value.tags,
    url: requireString(value.url, 'url'),
    content: requireString(value.content, 'content'),
  };

  if (!document.url.startsWith('/')) {
    throw new Error('Knowledge document URLs must be root-relative.');
  }
  return document;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Knowledge document ${field} must be a string.`);
  }
  return value;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isDocumentType(value: unknown): value is PublicDocumentType {
  return value === 'article' || value === 'project' || value === 'profile';
}
