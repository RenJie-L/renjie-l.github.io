import type { CollectionEntry } from 'astro:content';

export type Writing = CollectionEntry<'writing'>;
export type Project = CollectionEntry<'projects'>;

export const byNewest = (a: Writing, b: Writing) =>
  b.data.publishDate.valueOf() - a.data.publishDate.valueOf();

export const byProjectNewest = (a: Project, b: Project) =>
  b.data.sortDate.valueOf() - a.data.sortDate.valueOf();

export const byFeaturedProject = (a: Project, b: Project) =>
  (a.data.featuredOrder ?? Number.MAX_SAFE_INTEGER) -
    (b.data.featuredOrder ?? Number.MAX_SAFE_INTEGER) || byProjectNewest(a, b);

export const publishedOnly = (entry: Writing) => !entry.data.draft;

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);

export const tagSlug = (tag: string) => encodeURIComponent(tag.toLowerCase());
