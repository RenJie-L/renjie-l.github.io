import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const writing = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()),
    category: z.string(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    readingTime: z.number().positive(),
    language: z.enum(['zh-CN', 'en']),
    legacyUrl: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    period: z.string(),
    role: z.string(),
    technologies: z.array(z.string()),
    highlights: z.array(z.string()),
    links: z.array(z.object({ label: z.string(), url: z.string().url() })),
    featured: z.boolean().default(false),
  }),
});

export const collections = { writing, projects };
