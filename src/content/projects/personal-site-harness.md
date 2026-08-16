---
title: 'Personal Site Harness'
description: '面向公开个人站的只读 AI Agent：通过工具调用检索文章、项目与个人资料，并实时展示完整执行轨迹。'
period: '2026.08'
sortDate: '2026-08'
role: 'AI Agent Engineer'
technologies:
  ['AI Agent', 'DeepSeek', 'Cloudflare Workers', 'SSE', 'Astro', 'TypeScript']
highlights:
  - '实现模型适配器、工具注册表、多步 Agent Loop 与供应商无关的事件协议。'
  - '从 Astro Content Collections 生成公开知识索引，只提供无副作用的站内读取工具。'
  - '通过 SSE 实时展示文本增量、工具参数、工具结果与任务结束状态。'
links:
  - label: '项目详情'
    url: '/projects/personal-site-harness'
  - label: '在线体验'
    url: '/experiments/harness'
featured: true
draft: true
---

## 项目概览

Personal Site Harness 是一个为公开个人站设计的轻量 AI Agent。它可以回答关于文章、项目、技术栈和公开经历的问题，但不能运行 Shell、修改文件或访问任意网络地址。

项目重点并不是再做一个聊天框，而是完整实现模型之外的 Harness 工程：上下文怎样组装、工具怎样注册、每一步怎样推进、结果怎样写回模型、事件怎样流式传给浏览器，以及公网环境怎样通过硬限制控制成本和风险。

## 整体架构

```text
Astro 静态站点（GitHub Pages）
  ├─ /experiments/harness
  │    ├─ 对话界面
  │    └─ Runtime Trace
  └─ /harness-knowledge.json
       └─ 公开文章、项目与个人资料

Cloudflare Worker
  ├─ POST /v1/chat
  ├─ DeepSeek Model Adapter
  ├─ Agent Loop
  ├─ Tool Registry
  ├─ CORS / Rate Limit / Timeout
  └─ SSE Event Stream
```

GitHub Pages 继续托管静态内容，Cloudflare Worker 只负责保存密钥、调用模型和执行只读工具。两者通过版本化的 HTTP 与 SSE 协议连接，因此模型供应商或 Gateway 部署方式发生变化时，页面 UI 不需要跟着重写。

## Agent Loop

每轮任务最多执行有限次数的 model → tool → model 循环：

```text
用户消息
  ↓
组装系统提示、历史消息与工具 Schema
  ↓
调用 DeepSeek 并解析流式响应
  ↓
是否产生 Tool Call？
  ├─ 否：输出最终回答并结束
  └─ 是：校验、执行、记录结果，再进入下一 step
```

循环限制、工具调用上限、输入长度、输出长度和超时全部由代码执行，不依赖模型自行遵守。

## 公开知识索引

Astro 在构建阶段读取 Writing 与 Projects 两个 Content Collections，将非草稿中文文章、项目元数据、正文和公开个人资料转换成静态 JSON。

Gateway 只读取这份索引，因此不会接触 Git 仓库、构建环境和服务器文件系统。新增文章或项目后，下一次站点构建会自动更新 Agent 能够查询的内容。

第一版检索使用字段加权关键词搜索：标题、标签、摘要和正文分别使用不同权重，并针对中英文查询提取关键词。当前内容规模不需要额外引入向量数据库。

## 只读工具

| 工具           | 能力                              |
| -------------- | --------------------------------- |
| `search_site`  | 搜索文章、项目与公开资料          |
| `read_article` | 按内容 ID 读取文章正文            |
| `get_project`  | 返回项目详情、技术栈与链接        |
| `get_profile`  | 返回 About 页面已经公开的个人资料 |

工具不接受文件路径或任意 URL。所有参数先经过运行时校验，未知工具和不合法内容 ID 会作为结构化错误写回模型。

## 事件驱动 UI

Gateway 不向浏览器透传 DeepSeek 原始数据，而是转换为稳定的内部事件：

```text
turn.start
assistant.status
assistant.delta
tool.call
tool.result
assistant.message
turn.end
```

浏览器根据事件更新流式文字、在线状态和工具卡片。当前页面只使用原生 TypeScript 和 DOM API，没有为了一个聊天界面额外引入完整前端框架。

## 安全边界

公开版本执行以下硬限制：

- DeepSeek API Key 只保存在 Worker Secret；
- CORS 只允许个人站和本地开发地址；
- 按访客与网络来源进行分层限流；
- 每轮限制输入、历史、step、工具调用、Token 和总耗时；
- 工具只读取构建时发布的数据；
- 所有最终引用都必须是个人站根路径；
- 日志只记录请求 ID、耗时和错误，不记录对话正文与密钥。

这使项目可以展示真实 Agent 行为，同时避免把 Coding Agent 的高权限能力直接暴露给匿名访客。

## 后续方向

后续可以基于真实使用数据增加更好的中文检索、回答质量评测、Turnstile、防滥用预算、断线续传和持久会话。只有当内容规模证明关键词检索不足时，才会增加 Embedding 与向量检索。
