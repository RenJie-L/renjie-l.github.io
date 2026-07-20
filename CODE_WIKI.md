# Renjie 个人网站 Code Wiki

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 技术架构](#2-技术架构)
- [3. 目录结构](#3-目录结构)
- [4. 核心模块详解](#4-核心模块详解)
  - [4.1 内容集合 (Content Collections)](#41-内容集合-content-collections)
  - [4.2 国际化 (i18n)](#42-国际化-i18n)
  - [4.3 布局系统](#43-布局系统)
  - [4.4 组件系统](#44-组件系统)
  - [4.5 页面路由](#45-页面路由)
  - [4.6 样式系统](#46-样式系统)
  - [4.7 实验场景 (Three.js)](#47-实验场景-threejs)
  - [4.8 搜索功能 (Pagefind)](#48-搜索功能-pagefind)
- [5. 关键类与函数](#5-关键类与函数)
- [6. 依赖关系图](#6-依赖关系图)
- [7. 项目配置](#7-项目配置)
- [8. 运行与部署](#8-运行与部署)
- [9. 开发规范](#9-开发规范)

---

## 1. 项目概述

**项目名称**：renjie-l-github-io  
**项目类型**：个人品牌主页与技术博客  
**部署地址**：https://renjie-l.github.io  
**核心功能**：

- 技术博客文章展示（MDX 格式）
- 项目作品集展示
- 创意编程实验（WebGL / Three.js）
- 站内全文搜索
- 中英文双语支持
- 深色/浅色主题切换
- RSS 订阅
- 标签分类归档

---

## 2. 技术架构

### 2.1 核心技术栈

| 层级 | 技术选型 | 版本 | 用途 |
|------|---------|------|------|
| 框架 | Astro | ^5.12.1 | 静态站点生成、群岛架构 |
| 语言 | TypeScript | ^5.8.3 | 类型安全 |
| 样式 | Tailwind CSS | ^4.1.11 | 原子化 CSS（v4 全新架构） |
| 内容 | MDX | @astrojs/mdx ^4.3.3 | 支持组件的 Markdown |
| 3D 渲染 | Three.js | ^0.185.1 | WebGL 3D 场景 |
| 动画 | GSAP | ^3.15.0 | 高性能时间线动画 |
| 搜索 | Pagefind | ^1.3.0 | 静态站点全文搜索 |
| 图表 | Mermaid | ^11.16.0 | Markdown 图表渲染 |
| 图标 | Lucide | @lucide/astro ^1.25.0 | 图标库 |
| 高斯溅射 | Spark.js | @sparkjsdev/spark ^2.1.0 | 3D 高斯溅射渲染 |

### 2.2 架构模式

项目采用 **Astro Islands（群岛架构）**：

- 默认零 JavaScript，纯 HTML/CSS 输出
- 仅在需要交互的组件（海岛）上注入 JavaScript
- 客户端按需水合（Hydration）
- 优秀的首屏加载性能和 SEO

---

## 3. 目录结构

```
/workspace/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions 部署配置
├── public/                     # 静态资源（直接复制到输出）
│   ├── experiments/            # 实验页面静态资源
│   └── img/                    # 图片资源
├── src/
│   ├── components/             # Astro 组件
│   │   ├── experiments/        # 实验场景组件
│   │   ├── ArticleCard.astro   # 文章卡片
│   │   ├── Header.astro        # 页头导航
│   │   ├── Footer.astro        # 页脚
│   │   └── SearchDialog.astro  # 搜索对话框
│   ├── content/                # 内容集合（Markdown/MDX）
│   │   ├── projects/           # 项目内容
│   │   └── writing/            # 博客文章
│   ├── i18n/
│   │   └── config.ts           # 国际化配置
│   ├── layouts/                # 页面布局
│   │   ├── BaseLayout.astro    # 基础布局
│   │   └── WritingLayout.astro # 文章详情布局
│   ├── lib/
│   │   └── content.ts          # 内容工具函数
│   ├── pages/                  # 路由页面（文件即路由）
│   │   ├── en/                 # 英文版本页面
│   │   ├── experiments/        # 实验页面
│   │   ├── tags/               # 标签页（动态路由）
│   │   ├── writing/            # 文章页面
│   │   ├── rss.xml.ts          # RSS 生成
│   │   └── robots.txt.ts       # robots.txt 生成
│   ├── scripts/                # 客户端脚本（TypeScript）
│   │   ├── gaussian-splat/     # 高斯溅射场景
│   │   └── west-lake/          # 西湖场景
│   ├── styles/
│   │   └── global.css          # 全局样式
│   ├── content.config.ts       # 内容集合配置
│   └── env.d.ts                # 环境类型定义
├── astro.config.mjs            # Astro 配置
├── package.json                # 依赖管理
├── tsconfig.json               # TypeScript 配置
├── eslint.config.js            # ESLint 配置
└── .prettierrc.mjs             # Prettier 配置
```

---

## 4. 核心模块详解

### 4.1 内容集合 (Content Collections)

**配置文件**：[content.config.ts](file:///workspace/src/content.config.ts)

Astro Content Collections 提供类型安全的内容管理，使用 Zod 进行 Schema 校验。

#### Writing 集合（博客文章）

**Schema 字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | `string` | 是 | 文章标题 |
| `description` | `string` | 是 | 文章描述（用于 SEO 和列表） |
| `publishDate` | `Date` | 是 | 发布日期 |
| `updatedDate` | `Date` | 否 | 更新日期 |
| `tags` | `string[]` | 是 | 标签列表 |
| `category` | `string` | 是 | 分类 |
| `featured` | `boolean` | 否 | 是否精选（默认 false） |
| `draft` | `boolean` | 否 | 是否草稿（默认 false） |
| `readingTime` | `number` | 是 | 阅读时长（分钟） |
| `language` | `'zh-CN' \| 'en'` | 是 | 文章语言 |
| `legacyUrl` | `string` | 否 | 旧版 Hexo 博客 URL（用于兼容跳转） |

#### Projects 集合（项目作品）

**Schema 字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | `string` | 是 | 项目名称 |
| `description` | `string` | 是 | 项目描述 |
| `period` | `string` | 是 | 项目时间周期 |
| `role` | `string` | 是 | 担任角色 |
| `technologies` | `string[]` | 是 | 使用的技术栈 |
| `highlights` | `string[]` | 是 | 项目亮点列表 |
| `links` | `{label, url}[]` | 是 | 项目链接（支持相对/绝对 URL） |
| `featured` | `boolean` | 否 | 是否精选（默认 false） |
| `cover` | `{src, alt}` | 否 | 封面图片 |

**内容工具函数**：[lib/content.ts](file:///workspace/src/lib/content.ts)

- `byNewest(a, b)` — 按发布日期降序排序
- `publishedOnly(entry)` — 过滤掉草稿文章
- `formatDate(date)` — 格式化日期为中文长日期
- `tagSlug(tag)` — 标签 URL 编码

---

### 4.2 国际化 (i18n)

**配置文件**：[i18n/config.ts](file:///workspace/src/i18n/config.ts)

#### 设计原则

- **默认语言**：中文（zh-CN），无前缀 URL
- **英文语言**：路径前缀 `/en/`
- **导航文案**：集中管理在 `ui` 对象中
- **文章翻译**：不自动生成，手动添加独立 MDX 条目

#### 核心函数

| 函数 | 签名 | 说明 |
|------|------|------|
| `localizedPath(path, locale)` | `(string, Locale) => string` | 根据语言生成本地化路径 |
| `localeFromPath(path)` | `(string) => Locale` | 从 URL 路径推断当前语言 |

#### UI 文案结构

```typescript
ui['zh-CN'] = {
  nav: { writing, projects, archive, about },
  search: { ... },
  theme: '切换颜色主题',
  footerTagline: '持续学习，持续构建。',
  // ...
}
```

---

### 4.3 布局系统

#### BaseLayout — 基础布局

**文件**：[layouts/BaseLayout.astro](file:///workspace/src/layouts/BaseLayout.astro)

**功能职责**：

- HTML 文档结构（`<head>` + `<body>`）
- SEO Meta 标签（OG、Twitter Card、canonical、hreflang）
- 主题切换（深色/浅色，localStorage 持久化）
- 移动端菜单开关
- 页头（Header）、页脚（Footer）、搜索对话框（SearchDialog）注入
- View Transitions API 支持（`ClientRouter`）
- RSS 链接注入

**Props 接口**：

```typescript
interface Props {
  title?: string;              // 页面标题
  description?: string;        // 页面描述
  image?: string;              // OG 图片
  type?: 'website' | 'article'; // OG 类型
  noindex?: boolean;           // 禁止搜索引擎索引
  locale?: Locale;             // 当前语言
  hasTranslation?: boolean;    // 是否有翻译版本
  pageClass?: string;          // 页面 body 类名
  immersive?: boolean;         // 沉浸模式（隐藏 header/footer）
}
```

#### WritingLayout — 文章详情布局

**文件**：[layouts/WritingLayout.astro](file:///workspace/src/layouts/WritingLayout.astro)

**功能职责**：

- 文章头部信息（分类、标题、描述、日期、阅读时长、标签）
- 目录导航（TOC，桌面端侧边栏 + 移动端折叠）
- 文章正文渲染区（Prose 样式）
- 相邻文章导航（上一篇/下一篇）
- 代码块复制按钮
- Mermaid 图表源代码切换
- 目录滚动高亮（IntersectionObserver）

---

### 4.4 组件系统

#### Header — 页头导航

**文件**：[components/Header.astro](file:///workspace/src/components/Header.astro)

**功能**：

- 品牌 Logo 与首页链接
- 桌面端主导航（文章、项目、归档、关于）
- 搜索按钮（触发搜索对话框）
- 主题切换按钮（日/夜）
- 语言切换按钮
- GitHub 链接
- 移动端汉堡菜单

#### Footer — 页脚

**文件**：[components/Footer.astro](file:///workspace/src/components/Footer.astro)

**功能**：

- 品牌标语
- 链接组（RSS、Email、GitHub）
- 版权声明

#### ArticleCard — 文章卡片

**文件**：[components/ArticleCard.astro](file:///workspace/src/components/ArticleCard.astro)

**Props**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `article` | `Writing` | 必填 | 文章数据 |
| `compact` | `boolean` | `false` | 紧凑模式（隐藏描述） |

**展示内容**：分类、日期、阅读时长、标题、描述、标签

#### SearchDialog — 搜索对话框

**文件**：[components/SearchDialog.astro](file:///workspace/src/components/SearchDialog.astro)

**功能**：

- 基于原生 `<dialog>` 元素的模态框
- 懒加载 Pagefind UI（首次打开时才加载）
- 支持键盘快捷键 `⌘/Ctrl + K`
- 点击遮罩或按 Esc 关闭

**关键实现**：

```typescript
// 懒加载 Pagefind
const { PagefindUI } = await import('@pagefind/default-ui');
new PagefindUI({
  element: '#search',
  showSubResults: true,
  showImages: false,
  translations: { placeholder, zero_results },
});
```

---

### 4.5 页面路由

Astro 采用**文件即路由**的模式，`src/pages/` 下的文件自动生成路由。

#### 核心页面列表

| 路径 | 文件 | 说明 |
|------|------|------|
| `/` | `pages/index.astro` | 首页（精选文章、技术方向、精选项目、最近文章） |
| `/writing` | `pages/writing/index.astro` | 文章列表（分类筛选） |
| `/writing/[slug]` | `pages/writing/[slug].astro` | 文章详情（动态路由） |
| `/tags/[tag]` | `pages/tags/[tag].astro` | 标签归档页（动态路由） |
| `/projects` | `pages/projects.astro` | 项目列表 |
| `/archive` | `pages/archive.astro` | 文章归档 |
| `/about` | `pages/about.astro` | 关于页 |
| `/experiments/west-lake` | `pages/experiments/west-lake.astro` | 西湖 WebGL 实验 |
| `/experiments/gaussian-splat` | `pages/experiments/gaussian-splat.astro` | 高斯溅射实验 |
| `/rss.xml` | `pages/rss.xml.ts` | RSS 订阅源 |
| `/robots.txt` | `pages/robots.txt.ts` | 爬虫规则 |

#### 双语路由

- 中文版本：`/writing`、`/projects` 等（无前缀）
- 英文版本：`/en/writing`、`/en/projects` 等（`/en/` 前缀）
- 每个中文页面对应 `src/pages/en/` 下的英文版本

#### 动态路由示例

**文章详情页**：[pages/writing/[slug].astro](file:///workspace/src/pages/writing/[slug].astro)

```typescript
export async function getStaticPaths() {
  const articles = (await getCollection('writing'))
    .filter(publishedOnly)
    .sort(byNewest);
  return articles.map((article, index) => ({
    params: { slug: article.id },
    props: {
      article,
      previous: articles[index + 1],
      next: articles[index - 1],
    },
  }));
}
```

---

### 4.6 样式系统

**全局样式文件**：[styles/global.css](file:///workspace/src/styles/global.css)

#### 设计系统

**CSS 变量（自定义属性）**：

| 变量 | 浅色模式值 | 深色模式值 | 用途 |
|------|-----------|-----------|------|
| `--bg` | `#fbfbfc` | `#0d0e10` | 页面背景 |
| `--surface` | `#ffffff` | `#131519` | 表面色 |
| `--surface-2` | `#f4f5f7` | `#191b20` | 次级表面 |
| `--text` | `#18191b` | `#f0f1f3` | 正文文字 |
| `--muted` | `#676b73` | `#a1a5ad` | 次要文字 |
| `--line` | `#e4e5e8` | `#292c32` | 边框线条 |
| `--accent` | `#3559e0` | `#8ea7ff` | 强调色 |
| `--accent-soft` | `#edf1ff` | `#1a2343` | 柔和强调色 |
| `--code` | `#f5f6f8` | `#16181d` | 代码背景 |
| `--max` | `1120px` | `1120px` | 内容最大宽度 |

#### Tailwind CSS v4

项目使用 Tailwind CSS v4 的全新架构：

- 通过 `@tailwindcss/vite` 插件集成
- 使用 `@import 'tailwindcss'` 引入
- CSS-first 配置方式（不再需要 `tailwind.config.js`）

#### 响应式断点

| 断点 | 宽度 | 触发条件 |
|------|------|---------|
| 移动端 | ≤ 760px | 导航变汉堡菜单、网格变单列 |
| 平板端 | ≤ 960px | 文章目录侧边栏隐藏 |
| 桌面端 | > 960px | 完整双栏布局 |

#### 无障碍支持

- 跳过导航链接（Skip Link）
- `prefers-reduced-motion` 媒体查询支持
- 语义化 HTML 标签
- `aria-*` 属性完善
- 键盘导航支持（`focus-visible` 样式）

---

### 4.7 实验场景 (Three.js)

项目包含两个创意编程实验页面，均基于 Three.js 构建。

#### WestLakeScene — 西湖数字水墨场景

**文件**：[scripts/west-lake/WestLakeScene.ts](file:///workspace/src/scripts/west-lake/WestLakeScene.ts)

**场景元素**：

1. **程序化山峦** — 三层远山，使用 ShapeGeometry + 正弦波生成轮廓
2. **湖面 Shader** — 自定义 GLSL Shader 实现水波、涟漪、噪点纹理
3. **石拱桥** — CatmullRomCurve3 + TubeGeometry 生成弯曲桥体
4. **宝塔** — 五层宝塔，循环创建 Box + Cylinder 组合
5. **荷叶** — InstancedMesh 实例化渲染，性能优化
6. **雾气粒子** — CanvasTexture + Points 粒子系统
7. **飞鸟** — Line 几何体构成的极简鸟群

**交互功能**：

- 鼠标移动控制视角（视差效果）
- 点击湖面产生水波纹
- 入场相机动画（GSAP Timeline）
- 基于视口可见性自动暂停/恢复（IntersectionObserver）
- 标签页可见性变化时暂停（`visibilitychange`）

**质量分级**：

| 模式 | 触发条件 | 说明 |
|------|---------|------|
| Full | 桌面端 + 多核 CPU | 96x96 水面分段，72 个雾粒子，24 片荷叶 |
| Lite | 移动端 或 CPU ≤ 4 核 | 48x48 水面分段，34 个雾粒子，12 片荷叶 |
| Static | `prefers-reduced-motion` | 纯海报图片，无 WebGL |

**公共方法**：

| 方法 | 说明 |
|------|------|
| `init(onProgress)` | 初始化场景，进度回调 |
| `start()` | 启动渲染循环 |
| `pause()` | 暂停渲染 |
| `resume()` | 恢复渲染 |
| `skipIntro()` | 跳过入场动画 |
| `destroy()` | 销毁场景，释放资源 |

#### GaussianSplatScene — 高斯溅射场景

**文件**：[scripts/gaussian-splat/GaussianSplatScene.ts](file:///workspace/src/scripts/gaussian-splat/GaussianSplatScene.ts)

**技术特点**：

- 使用 `@sparkjsdev/spark` 库进行高斯溅射渲染
- 加载 SPZ 格式的 3D 场景文件（约 7.6 MB）
- OrbitControls 轨道控制器
- 自动旋转浏览
- 第一人称视角定位（室内漫游感）

**公共方法**：

| 方法 | 说明 |
|------|------|
| `init(onProgress)` | 初始化 WebGL 渲染器并加载场景 |
| `start()` | 启动渲染循环 |
| `resetView()` | 重置到默认视角 |
| `toggleAutoRotate()` | 切换自动旋转 |
| `destroy()` | 销毁场景，释放资源 |

---

### 4.8 搜索功能 (Pagefind)

**集成方式**：

1. **构建时索引**：`npm run build` 后自动执行 `pagefind --site dist`
2. **运行时搜索**：客户端懒加载 `@pagefind/default-ui`
3. **多语言支持**：Pagefind 自动处理中英文分词

**配置位置**：

- 构建命令：[package.json](file:///workspace/package.json) 中的 `build` 脚本
- UI 组件：[components/SearchDialog.astro](file:///workspace/src/components/SearchDialog.astro)
- 样式覆盖：[styles/global.css](file:///workspace/src/styles/global.css) 中的 `.pagefind-ui` 变量

---

## 5. 关键类与函数

### 5.1 类

#### WestLakeScene

```typescript
class WestLakeScene {
  constructor(root: HTMLElement)
  init(onProgress: ProgressHandler): void
  start(): void
  pause(): void
  resume(): void
  skipIntro(): void
  destroy(): void
  resize: () => void
}
```

**核心私有方法**：

- `createMountains()` — 创建三层远山
- `createWater()` — 创建带 Shader 的湖面
- `createBridge()` — 创建石拱桥
- `createPagoda()` — 创建五层宝塔
- `createLotus()` — 创建荷叶（InstancedMesh）
- `createMist()` — 创建雾气粒子
- `createBirds()` — 创建飞鸟
- `createLights()` — 设置光照
- `bindEvents()` — 绑定事件监听
- `animate(now)` — 渲染循环

#### GaussianSplatScene

```typescript
class GaussianSplatScene {
  constructor(root: HTMLElement)
  async init(onProgress: ProgressCallback): Promise<void>
  start(): void
  resetView(): void
  toggleAutoRotate(): boolean
  destroy(): void
}
```

**核心私有方法**：

- `frameSplat()` — 调整相机视角以适配场景
- `setupResize()` — 设置 ResizeObserver
- `resize()` — 响应尺寸变化

### 5.2 工具函数

#### content.ts

| 函数 | 签名 | 说明 |
|------|------|------|
| `byNewest` | `(a: Writing, b: Writing) => number` | 按发布日期降序排序（Array.sort 回调） |
| `publishedOnly` | `(entry: Writing) => boolean` | 过滤草稿（Array.filter 回调） |
| `formatDate` | `(date: Date) => string` | 格式化为「2024年1月1日」格式 |
| `tagSlug` | `(tag: string) => string` | 标签 URL 安全编码 |

#### i18n/config.ts

| 函数 | 签名 | 说明 |
|------|------|------|
| `localizedPath` | `(path: string, locale: Locale) => string` | 根据语言生成带前缀的路径 |
| `localeFromPath` | `(path: string) => Locale` | 从路径推断当前语言环境 |

---

## 6. 依赖关系图

### 6.1 页面依赖链

```
首页 (index.astro)
  ├─ BaseLayout
  │   ├─ Header
  │   │   └─ GithubIcon
  │   ├─ Footer
  │   └─ SearchDialog
  └─ ArticleCard

文章详情 ([slug].astro)
  └─ WritingLayout
      └─ BaseLayout
          └─ ... (同上)

文章列表 (writing/index.astro)
  ├─ BaseLayout
  └─ ArticleCard

项目页 (projects.astro)
  └─ BaseLayout

实验页 (experiments/west-lake.astro)
  ├─ BaseLayout (immersive 模式)
  └─ WestLakeExperience
      └─ WestLakeScene (动态 import)
```

### 6.2 数据流向

```
Content Collections (MDX/MD)
  ↓ (getCollection)
页面组件 (.astro)
  ↓ (props)
布局组件 (Layouts)
  ↓ (slots)
UI 组件 (Components)
  ↓ (客户端脚本)
浏览器交互
```

---

## 7. 项目配置

### 7.1 Astro 配置

**文件**：[astro.config.mjs](file:///workspace/astro.config.mjs)

```javascript
export default defineConfig({
  site: 'https://renjie-l.github.io',
  i18n: {
    locales: ['zh-CN', 'en'],
    defaultLocale: 'zh-CN',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [mermaid(), mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
  vite: { plugins: [tailwindcss()] },
});
```

**核心配置项说明**：

| 配置项 | 说明 |
|--------|------|
| `site` | 站点 URL，用于生成 sitemap、canonical 等 |
| `i18n.routing.prefixDefaultLocale` | 默认语言不加 URL 前缀 |
| `integrations` | 启用的集成：Mermaid 图表、MDX、Sitemap |
| `markdown.shikiConfig` | 代码高亮主题（双主题切换） |
| `vite.plugins` | Tailwind CSS v4 Vite 插件 |

### 7.2 TypeScript 配置

**文件**：[tsconfig.json](file:///workspace/tsconfig.json)

- 继承 `astro/tsconfigs/strict`
- 路径别名：`@/*` → `src/*`

### 7.3 ESLint 配置

**文件**：[eslint.config.js](file:///workspace/eslint.config.js)

使用 Flat Config 格式，集成：

- `@eslint/js` — ESLint 推荐规则
- `typescript-eslint` — TypeScript 推荐规则
- `eslint-plugin-astro` — Astro 组件推荐规则

### 7.4 Prettier 配置

**插件**：

- `prettier-plugin-astro` — 格式化 `.astro` 文件
- `prettier-plugin-tailwindcss` — 自动排序 Tailwind 类名

---

## 8. 运行与部署

### 8.1 环境要求

- **Node.js**：22+
- **包管理器**：npm

### 8.2 本地开发

```bash
# 安装依赖
npm ci

# 启动开发服务器
npm run dev
```

开发服务器默认运行在 `http://localhost:4321`

### 8.3 代码检查

```bash
# ESLint 代码检查
npm run lint

# Prettier 格式检查
npm run format:check

# Astro 类型检查
npm run check
```

### 8.4 生产构建

```bash
# 构建静态站点 + Pagefind 索引
npm run build

# 本地预览构建结果
npm run preview
```

构建产物输出到 `dist/` 目录

### 8.5 自动化部署

**配置文件**：[.github/workflows/deploy.yml](file:///workspace/.github/workflows/deploy.yml)

**触发条件**：

- `master` 分支推送
- 手动触发（workflow_dispatch）

**部署流程**：

```
1. Checkout 代码
2. Setup Node.js 22
3. npm ci 安装依赖
4. 代码检查（lint + format:check + check）
5. npm run build 构建
6. 上传 dist/ 为 Pages artifact
7. 部署到 GitHub Pages
```

**GitHub Pages 设置**：仓库的 Pages Source 需设置为 **GitHub Actions**

---

## 9. 开发规范

### 9.1 新增博客文章

1. 在 `src/content/writing/` 下创建 `.mdx` 文件
2. 文件名为文章 slug（URL 路径）
3. 顶部 Frontmatter 必须包含完整字段
4. 使用 `reading-time` 计算阅读时长

### 9.2 新增项目

1. 在 `src/content/projects/` 下创建 `.md` 文件
2. 填写完整的 Schema 字段
3. 如需封面图，放入 `public/` 目录

### 9.3 添加英文翻译

1. 在 `src/pages/en/` 下创建对应页面
2. 文章翻译添加为独立的 MDX 文件（`language: 'en'`）
3. 设置 `hasTranslation` prop 以启用 hreflang 标签

### 9.4 组件开发规范

- 使用 TypeScript 定义 Props 接口
- 优先使用 CSS 变量进行主题适配
- 交互组件考虑无障碍（aria 属性、键盘导航）
- 响应式设计（移动端优先）

### 9.5 Git 工作流

- 主分支：`master`（受保护，自动部署）
- 功能开发：创建 feature 分支，PR 合入

---

## 附录：NPM Scripts 速查

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建（含 Pagefind 索引） |
| `npm run preview` | 预览构建结果 |
| `npm run check` | Astro 类型检查 |
| `npm run lint` | ESLint 检查 |
| `npm run format` | Prettier 自动格式化 |
| `npm run format:check` | Prettier 格式检查 |
