---
title: '原神启动：WebGL 场景复刻'
description: '在浏览器中复刻《原神》启动场景，通过云海、天空道路、遗迹光柱与天空之门构建完整的沉浸式进入流程。'
period: '2025.09'
sortDate: '2025-09'
role: 'Creative Developer'
technologies: ['WebGL', 'xviewer', 'Three.js', 'GLSL', 'Astro']
highlights:
  - '复刻从资源加载、启动界面、云海飞行到进入天空之门的完整演出流程。'
  - '使用实例化渲染、自定义 Shader、FXAA、Bloom 与 ACES 色调映射还原原项目视觉效果。'
  - '场景与音频按需加载，并在 Astro 页面切换时完整释放渲染资源。'
links:
  - label: '进入场景'
    url: '/experiments/genshin'
featured: true
cover:
  src: '/assets/experiments/genshin/v1/ui/cover.jpg'
  alt: '云海、空中遗迹与发光天空之门'
---

一个完整复刻《原神》启动演出的沉浸式 WebGL 实验。场景保留参考项目的模型、Shader、后处理与音频时序，并将渲染核心接入 Astro 页面生命周期，实现从加载界面、云海飞行、天空之门生成到冲入白光的连续体验。
