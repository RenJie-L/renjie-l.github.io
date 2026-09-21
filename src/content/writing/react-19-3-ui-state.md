---
title: 'React 19.3：从动画、SSR 到并发渲染，React 正在把 UI 状态统一起来'
description: '从 ViewTransition、Fragment Refs 和 browser() 出发，探讨 React 如何将动画、异步加载、SSR、Hydration 与并发更新纳入统一的 UI 渲染模型。'
publishDate: 2026-09-21
tags: ['React', 'Frontend', 'SSR', 'Concurrent Rendering']
category: 'Frontend Engineering'
featured: false
draft: false
readingTime: 15
language: 'zh-CN'
---

React 19.3 于 2026 年 9 月正式发布。

如果只看更新列表，它似乎并不像 React 19.0 那样有 Actions、`use`、Server Components 等足够吸引眼球的大功能，但仔细看这次更新，会发现 React 19.3 的方向其实非常明确：

> React 正在继续把动画、异步加载、SSR、Hydration 和并发更新收进同一套渲染模型里。

这次最值得关注的三个 API 是：

```tsx
<ViewTransition />
Fragment ref
browser()
```

除此之外，React 还增强了 Transition 调度、Server Components、Trusted Types，并修复了大量 Suspense、Activity 和 Hydration 相关问题。

相比“React 新增了哪些 API”，更值得讨论的是：

**React 为什么需要这些 API？**

---

## 1. React 19.3 的核心不是新 API，而是统一 UI 状态

过去开发一个稍微复杂一点的 React 页面，往往会同时存在几套互不相关的机制。

例如页面跳转：

```text
React State
    ↓
页面发生变化
    ↓
Framer Motion / CSS
    ↓
执行动画
```

如果页面还涉及异步请求：

```text
请求数据
   ↓
Suspense
   ↓
Loading
   ↓
真实内容
```

如果再加上 SSR：

```text
Server Render
     ↓
HTML
     ↓
Hydration
     ↓
Client Render
```

每一层其实都有自己的状态。

开发者需要自己处理：

```text
加载状态
动画状态
客户端状态
服务端状态
Hydration 状态
```

React 19 这一系列版本正在尝试解决的问题，就是把这些东西逐渐统一到 React 自己的渲染生命周期里。

React 19.3 中最典型的例子，就是 `<ViewTransition>`。

---

## 2. ViewTransition：动画开始进入 React 渲染模型

React 19.3 中：

```tsx
<ViewTransition />
```

正式成为稳定 API。

它背后使用的是浏览器的 View Transition API，但 React 并不只是简单封装了一层浏览器接口。

真正重要的是：

> React 开始理解“这次 UI 更新需要动画”。

例如：

```tsx
import { ViewTransition, startTransition, useState } from 'react';

function App() {
  const [page, setPage] = useState('home');

  return (
    <>
      <button
        onClick={() => {
          startTransition(() => {
            setPage('detail');
          });
        }}
      >
        Detail
      </button>

      <ViewTransition>{page === 'home' ? <Home /> : <Detail />}</ViewTransition>
    </>
  );
}
```

这里发生的事情其实是：

```text
用户操作
   ↓
startTransition
   ↓
React 开始非紧急更新
   ↓
组件树发生变化
   ↓
ViewTransition 捕获变化
   ↓
浏览器执行动画
```

以前动画通常只是：

```text
DOM 发生变化之后
再想办法给 DOM 加动画
```

现在则逐渐变成：

```text
React 在决定如何更新 UI 时
就知道这里存在一次 Transition
```

这是两种完全不同的设计思路。

---

### ViewTransition 不只是 enter / exit 动画

最简单的场景当然是：

```text
旧组件
  ↓
淡出

新组件
  ↓
淡入
```

但 React 的 ViewTransition 还可以识别几种不同的 UI 变化：

```text
enter
exit
update
share
```

例如详情页中的图片：

```text
列表页小图
      ↓
点击
      ↓
详情页大图
```

过去实现这种 Shared Element Transition，通常需要开发者自己：

- 获取 DOM 坐标
- 计算位置差
- clone 元素
- 执行动画
- 清理临时节点

现在 React 可以把同一个视觉元素的变化交给 View Transition 系统处理。

这对于：

```text
图片详情
卡片展开
页面导航
Gallery
作品展示
个人主页
```

都很有用。

尤其是偏视觉化的网站，React 19.3 的这个变化会非常明显。

---

## 3. 动画开始和 Suspense、Transition 结合

如果 `<ViewTransition>` 只是一个动画组件，其实意义并没有那么大。

真正有意思的是它可以和：

```tsx
startTransition();
Suspense;
useDeferredValue();
```

一起工作。

假设页面存在异步内容：

```tsx
<ViewTransition>
  <Suspense fallback={<Loading />}>
    <Profile />
  </Suspense>
</ViewTransition>
```

页面可能经历：

```text
Loading
   ↓
数据加载完成
   ↓
Profile
```

以前这个变化通常是瞬间发生：

```text
Skeleton
   ↓
啪
   ↓
真实内容
```

现在 React 可以让这个过程进入 View Transition。

于是：

```text
Suspense 状态变化
        ↓
React Commit
        ↓
View Transition
        ↓
平滑切换
```

这里可以看到 React 目前越来越明显的一条设计路线：

```text
Transition
     │
     ├── Suspense
     │
     ├── Lazy
     │
     ├── Deferred Value
     │
     └── View Transition
     │
     ▼
统一描述 UI 的异步变化
```

也就是说，React 不再把：

```text
加载
动画
页面切换
```

视作完全不同的问题。

它们本质上都是：

> UI 从状态 A 变化到状态 B。

---

## 4. Fragment Refs：终于不用为了 ref 多套一个 div

React 19.3 另一个非常实用的更新是 Fragment Refs 正式稳定。

我们经常会写：

```tsx
<>
  <Header />
  <Content />
  <Footer />
</>
```

Fragment 最大的好处是不会增加额外 DOM。

最终得到：

```html
<header />
<main />
<footer />
```

而不是：

```html
<div>
  <header />
  <main />
  <footer />
</div>
```

但它一直存在一个问题：

> Fragment 没有 DOM，那么怎么对这一整组 DOM 操作？

例如需要：

```text
focus
scrollIntoView
IntersectionObserver
ResizeObserver
事件监听
DOM Rect
```

以前最简单粗暴的方法通常是：

```tsx
<div ref={ref}>
  <Header />
  <Content />
  <Footer />
</div>
```

问题是这个 `<div>` 有时候会破坏布局。

尤其是：

```css
display: grid;
display: flex;
```

这种强依赖 DOM 层级的布局。

React 19.3 终于允许：

```tsx
import { Fragment, useRef } from 'react';

function Layout() {
  const ref = useRef(null);

  return (
    <Fragment ref={ref}>
      <Header />
      <Content />
      <Footer />
    </Fragment>
  );
}
```

这里：

```tsx
ref.current;
```

并不是 HTMLElement，而是：

```text
FragmentInstance
```

它代表这一组 DOM。

---

### FragmentInstance 本质上是“虚拟 DOM 容器”

这是我觉得 Fragment Ref 最有意思的地方。

以前：

```text
DOM Container
     ↓
真实 div
```

现在可以：

```text
Fragment
   ↓
FragmentInstance
   ↓
一组 DOM
```

你可以对它进行：

```tsx
focus();
focusLast();
blur();
scrollIntoView();
getClientRects();
```

也可以：

```tsx
addEventListener();
removeEventListener();
```

甚至可以配合：

```text
IntersectionObserver
ResizeObserver
```

所以以后一些组件：

```tsx
<List />
<Popover />
<Menu />
<Toolbar />
<Layout />
```

不再需要为了获得一个 `ref` 而强行制造 wrapper。

对于普通业务项目，这个功能可能不会每天使用。

但对于：

```text
组件库
设计系统
编辑器
复杂布局
底层 UI Framework
```

它会非常有价值。

---

## 5. browser()：SSR 不再需要到处判断 window

React 项目只要开始 SSR，就很容易遇到：

```text
window is not defined
```

因为服务器上不存在：

```js
window;
document;
localStorage;
navigator;
```

所以过去代码里经常出现：

```tsx
if (typeof window === 'undefined') {
  return null;
}
```

或者：

```tsx
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);
```

这种代码能工作，但它有一个问题：

> React 并不知道组件为什么现在不能渲染。

对于 React 来说，这只是普通的条件判断。

React 19.3 新增：

```tsx
browser();
```

来自：

```tsx
import { browser } from 'react-dom';
```

然后可以：

```tsx
import { use } from 'react';
import { browser } from 'react-dom';

function LocalStoragePanel() {
  use(browser());

  const value = localStorage.getItem('config');

  return <div>{value}</div>;
}
```

它表达的是：

> 这个组件必须等到浏览器环境才能继续渲染。

在服务器上：

```text
use(browser())
     ↓
Suspend
```

在浏览器：

```text
use(browser())
     ↓
继续执行
```

于是就可以自然地结合：

```tsx
<Suspense fallback={<Skeleton />}>
  <LocalStoragePanel />
</Suspense>
```

整个流程变成：

```text
Server Render
     ↓
browser() Suspend
     ↓
Suspense fallback
     ↓
HTML 返回浏览器
     ↓
Hydration
     ↓
browser() 可用
     ↓
真实组件渲染
```

---

### browser() 真正解决的是“环境也是一种异步依赖”

这是一个很 React 的设计。

以前：

```tsx
typeof window !== 'undefined';
```

描述的是：

```text
现在运行在哪里？
```

而：

```tsx
use(browser());
```

描述的是：

```text
当前组件依赖 Browser 环境
```

两者的区别非常重要。

因为一旦它被描述成“依赖”，React 就可以把它加入：

```text
Suspense
Streaming SSR
Hydration
Transition
```

整个体系。

从这个角度看，`browser()` 并不是一个简单的：

```js
isBrowser();
```

它更像：

```text
Browser Environment Promise
```

React 把“等待客户端”也变成了一种 Suspense。

---

## 6. React 的并发模型继续成熟

React 19.3 还有一个容易被新 API 掩盖的更新：

> 不相关的 Transition 可以更加独立地渲染。

假设页面中同时发生两次更新：

```text
搜索结果更新
+
侧边栏切换
```

过去一些情况下：

```text
Transition A
       │
       └──────┐
              ↓
Transition B ─┘
              ↓
          一起等待
```

其中一个 Transition 很慢，就可能影响另外一个。

React 19.3 进一步改善了这种调度：

```text
Transition A ─────────────→

Transition B ─────→
```

它们可以更加独立地推进。

对于普通 CRUD 页面，这个变化可能基本感觉不到。

但如果应用大量使用：

```tsx
startTransition();
useDeferredValue();
Suspense;
```

或者本身是：

```text
编辑器
复杂 Dashboard
3D 应用
大型 SaaS
交互式设计工具
```

这种调度优化会越来越重要。

因为 React 的目标已经不只是：

```text
state 变化
↓
重新 render
```

而是：

```text
很多不同优先级的 UI 更新
同时存在
↓
React 决定什么时候渲染什么
```

这就是 Concurrent React 真正想解决的问题。

---

## 7. Server Components 和 Web 平台继续补齐

除了三个主要 API，React 19.3 还有一些值得关注的基础能力升级。

### Server Components 可以直接提供 Context

以前 Server Component 向 Client Component Tree 提供 Context 时，经常需要额外包装一个 Provider Component。

现在可以直接：

```tsx
<UserContext value={user}>{children}</UserContext>
```

减少了一层纯粹为了 Context 存在的 Client Wrapper。

整个数据流开始变得更自然：

```text
Database
   ↓
Server Component
   ↓
Context
   ↓
Client Components
```

这对于 React Server Components 来说是一个很合理的补全。

---

### Trusted Types

React 19.3 也开始更完整地支持浏览器 Trusted Types。

它主要解决：

```text
DOM XSS
```

相关安全问题。

例如开启：

```http
Content-Security-Policy:
require-trusted-types-for 'script'
```

之后，浏览器会要求一些危险 DOM API 使用：

```text
TrustedHTML
TrustedScript
TrustedScriptURL
```

而不是普通字符串。

对于一般个人项目影响不大。

但：

```text
企业应用
金融系统
大型 SaaS
高安全等级后台
```

会比较有价值。

从这点也能看到 React 现在越来越倾向于：

> 尽可能直接适配现代 Web Platform，而不是重新创造一套浏览器能力。

---

## 8. React 19.3 到底意味着什么？

如果只记 React 19.3 的更新内容，其实只需要记三个东西：

```text
ViewTransition
Fragment Refs
browser()
```

但如果从 React 的发展方向来看，我觉得 19.3 更值得关注的是另外一件事：

React 正在逐渐形成这样一套模型：

```text
                    UI State
                       │
                       ▼
                   Transition
                 /      |      \
                /       |       \
               ▼        ▼        ▼
          Suspense   Deferred   Animation
               │                 │
               │           ViewTransition
               ▼
             SSR
               │
          Streaming
               │
               ▼
          Hydration
               │
               ▼
            Browser
```

以前我们习惯把这些东西分开看：

```text
React 管状态
React Router 管页面
Suspense 管 Loading
Framer Motion 管动画
SSR Framework 管服务端
浏览器 API 管 DOM
```

React 19 之后，这些边界开始发生变化。

React 越来越希望：

```text
UI 的变化
```

无论来自：

```text
用户操作
数据加载
页面跳转
服务端渲染
客户端 Hydration
动画
```

都能够被描述成 React 自己理解的一次“状态转换”。

这也是为什么：

```tsx
startTransition()
Suspense
use()
<Activity />
<ViewTransition />
browser()
```

这些看起来完全不同的 API，最后会不断产生联系。

---

## 总结

React 19.3 并不是一次类似 React Hooks 那样改变开发方式的版本。

如果你的项目只是：

```text
表单
列表
CRUD
后台管理
```

升级之后甚至可能感觉不到明显变化。

但对于正在使用：

```text
SSR
Suspense
Server Components
复杂动画
大型交互应用
```

的项目来说，React 19.3 展示的方向非常值得关注。

其中最值得尝试的是：

```tsx
<ViewTransition />
```

最实用的底层能力可能是：

```tsx
Fragment ref
```

而最能体现 React 新设计理念的 API，我认为反而是：

```tsx
use(browser());
```

因为它体现了一件事情：

> React 正在把越来越多原本需要开发者手动判断的“外部状态”，转换成 React 可以调度的“渲染状态”。

从 React 18 的 Concurrent Rendering，到 React 19 的 Actions、`use`、Activity，再到 React 19.3 的 ViewTransition 和 `browser()`，React 的方向其实已经越来越清晰：

```text
React 不只是一个把 State 映射成 DOM 的 UI Library。

它正在逐渐成为一个
负责协调数据、异步任务、服务端渲染、页面切换和视觉变化的 UI Runtime。
```

这可能才是 React 19.3 最值得关注的地方。
