export interface UniverseProject {
  slug: string;
  title: { 'zh-CN': string; en: string };
  description: { 'zh-CN': string; en: string };
  technologies: string[];
  status: 'active' | 'completed' | 'experimental';
  href: { 'zh-CN': string; en: string };
  planetSize: number;
  position: [number, number, number];
  orbitSpeed: number;
  accent: string;
}

export const universeProjects: UniverseProject[] = [
  {
    slug: 'ai-engineering',
    title: { 'zh-CN': 'AI 工程实践', en: 'AI Engineering Lab' },
    description: {
      'zh-CN': '探索 AI Agent、上下文工程与大型项目中的智能协作。',
      en: 'Exploring AI agents, context engineering, and intelligent collaboration in large projects.',
    },
    technologies: ['Agent', 'LLM', 'DX'],
    status: 'active',
    href: { 'zh-CN': '/writing/ai-coding-best-practices-2', en: '/en/writing' },
    planetSize: 0.42,
    position: [-3.15, 1.35, -1.1],
    orbitSpeed: 0.18,
    accent: '#64d8ff',
  },
  {
    slug: 'frontend-systems',
    title: { 'zh-CN': '前端工程系统', en: 'Frontend Systems' },
    description: {
      'zh-CN': '围绕 React、TypeScript 与可持续演进 Web 架构的实践记录。',
      en: 'Practice notes on React, TypeScript, and web architecture built to evolve.',
    },
    technologies: ['React', 'TypeScript', 'Astro'],
    status: 'active',
    href: { 'zh-CN': '/writing', en: '/en/writing' },
    planetSize: 0.34,
    position: [3.2, 1.15, -0.6],
    orbitSpeed: 0.14,
    accent: '#8c82ff',
  },
  {
    slug: 'uav-research',
    title: { 'zh-CN': '强化学习无人机研究', en: 'UAV Reinforcement Learning' },
    description: {
      'zh-CN': '使用深度强化学习规划无人机悬挂负载无摆动轨迹，并完成实机验证。',
      en: 'Deep-RL trajectory planning for swing-free suspended UAV loads, validated on hardware.',
    },
    technologies: ['RL', 'UAV', 'Python'],
    status: 'completed',
    href: { 'zh-CN': '/projects', en: '/en/projects' },
    planetSize: 0.5,
    position: [2.55, -1.85, -1.7],
    orbitSpeed: 0.11,
    accent: '#f0ad5f',
  },
  {
    slug: 'west-lake',
    title: { 'zh-CN': '西湖数字场景', en: 'West Lake WebGL Experience' },
    description: {
      'zh-CN': '以 Three.js、Shader 和水墨语言构建的原创西湖数字场景。',
      en: 'An original West Lake scene shaped with Three.js, shaders, and digital ink wash.',
    },
    technologies: ['Astro', 'Three.js', 'GSAP'],
    status: 'experimental',
    href: {
      'zh-CN': '/experiments/west-lake',
      en: '/en/experiments/west-lake',
    },
    planetSize: 0.3,
    position: [-2.65, -1.65, -0.8],
    orbitSpeed: 0.22,
    accent: '#73e6bb',
  },
];

export const universeConfig = {
  particles: { desktop: 1800, tablet: 1000, mobile: 460 },
  camera: { fov: 45, near: 0.1, far: 120 },
  renderer: { maxPixelRatioDesktop: 1.6, maxPixelRatioMobile: 1.2 },
  motion: { introDuration: 1.8, cameraLerp: 0.045 },
} as const;
