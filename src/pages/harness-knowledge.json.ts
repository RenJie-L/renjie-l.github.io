import { getCollection } from 'astro:content';
import { publishedOnly } from '@/lib/content';

export const prerender = true;

const profile = {
  id: 'renjie-profile',
  type: 'profile' as const,
  title: 'Renjie 公开资料',
  description:
    '前端工程师，关注 Web 3D、实时渲染、AI Agent、工程化与智能应用。',
  tags: ['React', 'TypeScript', 'Astro', 'WebGL', 'AI Agent'],
  url: '/about',
  content:
    'Renjie 是一名前端工程师，持续使用 React、TypeScript、WebGL 构建复杂的三维编辑器、渲染 SDK 与 Web 应用。目前关注 Web 3D、实时渲染、3D Gaussian Splatting、AI Agent、上下文工程和强化学习。个人站公开内容包括技术文章、工程项目与浏览器交互实验。',
};

export async function GET() {
  const [articles, projects] = await Promise.all([
    getCollection('writing'),
    getCollection('projects'),
  ]);

  const documents = [
    ...articles
      .filter(
        (article) =>
          publishedOnly(article) && article.data.language === 'zh-CN',
      )
      .map((article) => ({
        id: article.id,
        type: 'article' as const,
        title: article.data.title,
        description: article.data.description,
        tags: article.data.tags,
        url: `/writing/${article.id}`,
        content: article.body ?? article.data.description,
      })),
    ...projects.filter(publishedOnly).map((project) => ({
      id: project.id,
      type: 'project' as const,
      title: project.data.title,
      description: project.data.description,
      tags: project.data.technologies,
      url: `/projects/${project.id}`,
      content: [
        project.body ?? '',
        ...project.data.highlights,
        ...project.data.technologies,
      ].join('\n'),
    })),
    profile,
  ];

  return new Response(
    JSON.stringify({
      version: new Date().toISOString(),
      documents,
    }),
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
}
