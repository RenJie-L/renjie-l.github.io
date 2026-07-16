import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { byNewest, publishedOnly } from '@/lib/content';

export async function GET(context: { site?: URL }) {
  const articles = (await getCollection('writing'))
    .filter(publishedOnly)
    .sort(byNewest);
  return rss({
    title: 'Renjie Writing',
    description: '前端工程、AI 编程、智能体与强化学习的技术实践。',
    site: context.site!,
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.publishDate,
      link: `/writing/${article.id}`,
      categories: article.data.tags,
    })),
    customData: '<language>zh-CN</language>',
  });
}
