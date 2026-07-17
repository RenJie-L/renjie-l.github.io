export const locales = ['zh-CN', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh-CN';

export const ui = {
  'zh-CN': {
    nav: {
      writing: '文章',
      projects: '项目',
      archive: '归档',
      about: '关于',
    },
    skip: '跳到主要内容',
    home: 'Renjie 首页',
    mainNav: '主导航',
    mobileNav: '移动端导航',
    search: '搜索文章',
    searchShortcut: '搜索（⌘ K）',
    searchClose: '关闭搜索',
    searchPlaceholder: '搜索标题、标签或正文…',
    searchEmpty: '没有找到相关内容',
    searchUnavailable: '搜索索引将在生产构建后可用。',
    noScript: '请启用 JavaScript 使用站内搜索。',
    theme: '切换颜色主题',
    menuOpen: '打开导航',
    menuClose: '关闭导航',
    language: 'Switch to English',
    languageShort: 'EN',
    footerTagline: '持续学习，持续构建。',
  },
  en: {
    nav: {
      writing: 'Writing',
      projects: 'Projects',
      archive: 'Archive',
      about: 'About',
    },
    skip: 'Skip to main content',
    home: 'Renjie home',
    mainNav: 'Main navigation',
    mobileNav: 'Mobile navigation',
    search: 'Search writing',
    searchShortcut: 'Search (⌘ K)',
    searchClose: 'Close search',
    searchPlaceholder: 'Search titles, tags, or content…',
    searchEmpty: 'No matching content found',
    searchUnavailable: 'Search will be available after a production build.',
    noScript: 'Enable JavaScript to use site search.',
    theme: 'Switch color theme',
    menuOpen: 'Open navigation',
    menuClose: 'Close navigation',
    language: '切换到中文',
    languageShort: '中',
    footerTagline: 'Keep learning. Keep building.',
  },
} as const;

export function localizedPath(path: string, locale: Locale) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'en') {
    if (normalized === '/') return '/en/';
    return normalized.startsWith('/en/') ? normalized : `/en${normalized}`;
  }

  const withoutLocale = normalized.replace(/^\/en(?=\/|$)/, '');
  return withoutLocale || '/';
}

export function localeFromPath(path: string): Locale {
  return /^\/en(?:\/|$)/.test(path) ? 'en' : 'zh-CN';
}
