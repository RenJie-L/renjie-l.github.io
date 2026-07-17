# Renjie — Personal website

个人品牌主页与技术博客，使用 Astro、TypeScript、Tailwind CSS、MDX、Content Collections、Shiki 与 Pagefind 构建。

## Local development

要求 Node.js 22+。

```bash
npm ci
npm run dev
```

## Validation

```bash
npm run lint
npm run format:check
npm run check
npm run build
```

## Deployment

`master` 分支更新后，GitHub Actions 构建 `dist/` 并发布到 GitHub Pages。仓库 Pages Source 需要设置为 **GitHub Actions**。

旧 Hexo 文章的静态页面暂时保存在 `public/`；已迁移内容使用静态兼容页跳转到新的 `/writing/[slug]` 地址。

## Internationalization

- Chinese is the default locale and keeps the existing unprefixed URLs.
- English UI routes use the `/en` prefix.
- Shared navigation and interface copy live in `src/i18n/config.ts`.
- English article translations are not generated automatically; add them as separate MDX entries when ready.
