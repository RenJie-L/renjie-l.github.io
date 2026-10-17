# Renjie — Personal website

个人品牌主页与技术博客，使用 Astro、TypeScript、Tailwind CSS、MDX、Content Collections、Shiki 与 Pagefind 构建。

## Local development

要求 Node.js 22.22.3+（22.x）或 24.16+（24.x）与 npm 9.6+。仓库的 `.nvmrc` 和部署流程使用 Node.js 24。

```bash
nvm use
npm ci
npm run dev
```

## Validation

```bash
npm run lint
npm run format:check
npm run check
npm run audit
npm run build
npm test
```

安装依赖后 Husky 会自动启用 Git hooks。每次提交前会对暂存文件运行 ESLint 和 Prettier，并执行完整的 Astro 内容与类型检查。也可以手动运行：

```bash
npm run precommit
npm run validate
```

KaTeX 同时供公式解析、Mermaid 和页面样式使用，通过 `overrides` 统一到直接依赖的版本。更新它时需要一起检查公式与图表渲染。

## Deployment

所有 Pull Request 与 `master` 推送都会运行校验、依赖审计、构建和产物 smoke test；仅 `master` 推送会发布到 GitHub Pages。仓库 Pages Source 需要设置为 **GitHub Actions**。

旧 Hexo 文章的静态页面暂时保存在 `public/`；已迁移内容使用静态兼容页跳转到新的 `/writing/[slug]` 地址。

## Internationalization

- Chinese is the default locale and keeps the existing unprefixed URLs.
- English UI routes use the `/en` prefix.
- Shared navigation and interface copy live in `src/i18n/config.ts`.
- English article translations are not generated automatically; add them as separate MDX entries when ready.
