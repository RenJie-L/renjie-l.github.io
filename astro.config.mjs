import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import mermaid from 'astro-mermaid';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

const hasStandaloneLocaleIndex = (url) =>
  /\/(?:en\/)?(?:writing|archive)\/?$/.test(new URL(url).pathname);

export default defineConfig({
  site: 'https://renjie-l.github.io',
  i18n: {
    locales: ['zh-CN', 'en'],
    defaultLocale: 'zh-CN',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    mermaid({
      theme: 'forest',
      autoTheme: true,
    }),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'zh-CN',
        locales: { 'zh-CN': 'zh-CN', en: 'en' },
      },
      // These are navigable locale indexes, not translations of one another.
      // Avoid emitting false xhtml alternates in the generated sitemap.
      serialize(item) {
        return hasStandaloneLocaleIndex(item.url)
          ? { ...item, links: undefined }
          : item;
      },
    }),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
    headingAnchorPrefix: '',
  },
  vite: { plugins: [tailwindcss()] },
});
