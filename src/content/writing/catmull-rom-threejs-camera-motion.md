---
title: '从 Catmull–Rom 到稳定的 Three.js 相机轨迹'
description: '从 Catmull–Rom 样条出发，理解 Three.js 中的曲线参数化、弧长采样、相机姿态与稳定路径跟随的工程实现。'
publishDate: 2026-09-09
tags:
  - Three.js
  - 3D
  - Catmull-Rom
  - Camera
  - Graphics
category: 'Computer Graphics'
featured: true
draft: false
hasMath: true
readingTime: 20
language: 'zh-CN'
---

在 3D 场景里，只要开始做“沿一条路径移动”，很快就会遇到一个非常基础的问题：

> 已经有了一组关键点，怎样让相机、角色或物体平滑地经过这些点，而不是沿折线生硬地转弯？

例如一个简单的室内漫游路径：

```text
P0 ───── P1
          \
           \
            P2 ─────── P3
```

如果直接在线段之间插值，物体经过 `P1`、`P2` 时会突然改变方向。我们真正希望得到的是一条**经过所有关键点，同时保持连续和平滑**的路径。

Catmull–Rom Spline 正是解决这类问题的经典方法之一。

Three.js 已经内置了 `CatmullRomCurve3`，所以“生成一条平滑曲线”并不难。真正有意思的是：当它被用于相机轨迹以后，还会继续遇到一系列新的问题：

- 为什么不同的 `curveType` 会生成不同形状？
- 为什么沿曲线运动时会忽快忽慢？
- 为什么只使用 `camera.lookAt()` 有时会翻转或抖动？
- 为什么室内漫游和过山车不能使用同一种相机姿态策略？
- Frenet Frame 和 Parallel Transport 分别解决什么问题？

这篇文章会从 Catmull–Rom 本身出发，一直走到一套可以实际用于 Three.js、3DGS 和建筑漫游的相机轨迹方案。

---

## 1. 为什么需要 Catmull–Rom

Catmull–Rom 是一种**插值样条曲线（interpolating spline）**。

“插值”意味着一个非常重要的性质：

> 给定的控制点本身就在最终曲线上。

假设有四个控制点：

```text
P0 → P1 → P2 → P3
```

Catmull–Rom 会生成一条依次经过这些点的平滑曲线。

这和 Bezier Curve 有一个很重要的区别。Bezier 的中间控制点更像是在“拉扯”曲线，曲线通常不一定经过它们；而 Catmull–Rom 的控制点本身就是路径节点。

所以当控制点来自：

- 用户点击生成的路径点
- 相机关键帧
- 导航节点
- 赛车轨迹
- 3DGS 场景中的漫游点

Catmull–Rom 往往会比 Bezier 更符合直觉。

### 一段曲线为什么需要四个点

Catmull–Rom 的一段曲线虽然是从 `P1` 走到 `P2`，但它还需要参考两侧的 `P0` 和 `P3`：

```text
P0 ─── P1 ═════════ P2 ─── P3
          当前曲线段
```

其中：

- `P1`：当前曲线段的起点
- `P2`：当前曲线段的终点
- `P0`：帮助确定 `P1` 附近的切线方向
- `P3`：帮助确定 `P2` 附近的切线方向

经典 Uniform Catmull–Rom 可以写成：

$$
P(t)=\frac12[
2P_1+
(-P_0+P_2)t+
(2P_0-5P_1+4P_2-P_3)t^2+
(-P_0+3P_1-3P_2+P_3)t^3
]
$$

其中：

$$
0 \le t \le 1
$$

并且：

$$
P(0)=P_1,\qquad P(1)=P_2
$$

所以这段曲线一定会从 `P1` 出发，并最终经过 `P2`。

从直觉上可以把它理解为：

> Catmull–Rom 会利用相邻控制点自动估计当前节点的切线，然后用这些切线把控制点平滑地连接起来。

因此不需要像 Bezier 那样额外维护控制手柄，就能得到一条适合路径系统的平滑曲线。

---

## 2. Catmull–Rom 的参数化方式

如果所有控制点都均匀分布，那么事情会比较简单。但真实场景里的控制点通常不会等距。

例如：

```text
A -- B ----------------------------- C --- D
```

它们之间的距离可能是：

```text
AB = 1m
BC = 15m
CD = 2m
```

这时就出现了一个关键问题：

> 在曲线的内部参数空间中，这三个区间应该被看成一样长吗？

不同的处理方式，就产生了 Catmull–Rom 的不同参数化。

通常可以统一表示为：

$$
t_{i+1}=t_i+\|P_{i+1}-P_i\|^\alpha
$$

其中 `α` 决定“真实距离”对曲线参数的影响程度。

Three.js 中常见的三种模式是：

| `curveType`   |   α | 参数化方式  |
| ------------- | --: | ----------- |
| `catmullrom`  |   0 | Uniform     |
| `centripetal` | 0.5 | Centripetal |
| `chordal`     |   1 | Chordal     |

### Uniform：`catmullrom`

Uniform 会把相邻控制点之间的参数间隔都看成一样大。

真实距离：

```text
1m / 15m / 2m
```

在参数空间里仍然近似被当成：

```text
1 / 1 / 1
```

当控制点比较均匀时，这通常没有问题；但当点之间距离差异很大时，就可能产生：

- overshoot
- 异常鼓包
- cusp
- loop
- 自交

Three.js 中可以这样创建：

```ts
const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
```

这里最后一个参数 `tension` 主要作用于经典 `catmullrom` 模式。

可以把它理解为：

> 控制点处切向量的强度。

它影响曲线经过控制点时“延伸出去”的程度，而不是简单意义上的“越大越紧”。

### Centripetal：`centripetal`

Centripetal 使用：

$$
\alpha=0.5
$$

因此：

$$
\Delta t=\sqrt{\|P_{i+1}-P_i\|}
$$

假设三段距离是：

```text
1 / 9 / 4
```

对应的参数间隔近似为：

```text
1 / 3 / 2
```

它既考虑控制点之间的真实距离，又不会让距离的影响过强，因此通常能够减少：

- 曲线自交
- 急剧鼓包
- 尖锐拐点
- 控制点分布不均导致的异常形变

这也是 Three.js 的默认选择。

对于一般的 3D 路径，可以直接从它开始：

```ts
const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
```

尤其适合：

- 相机漫游
- 建筑导览
- 3DGS / Gaussian Splatting
- 用户手工创建的路径
- 角色移动轨迹

### Chordal：`chordal`

Chordal 对应：

$$
\alpha=1
$$

也就是：

$$
\Delta t=\|P_{i+1}-P_i\|
$$

相比 `centripetal`，它更直接地反映真实距离。

这并不意味着它更“正确”，只是距离对曲线形态的影响更强。对于大多数交互式 3D 场景，`centripetal` 往往已经足够稳定。

因此一个很实用的选择策略是：

```text
普通 Three.js / 3DGS 路径
            ↓
       centripetal

需要调经典 tension
            ↓
       catmullrom

明确需要 chord-length 参数化
            ↓
          chordal
```

如果没有特殊需求，优先使用：

```ts
'centripetal';
```

---

## 3. 从曲线到匀速运动

有了平滑曲线以后，最直接的动画写法是：

```ts
progress += delta;

const position = curve.getPoint(progress);
camera.position.copy(position);
```

看起来没有问题，但运行以后经常会发现：

> 相机沿曲线运动时会忽快忽慢。

原因是：

```text
数学参数增加相同
≠
世界空间移动距离相同
```

`getPoint(t)` 中的 `t` 只是曲线内部参数，而不是已经走过的真实距离。

例如：

```text
t = 0.1 → 0.2
```

可能移动了 0.5 米，而：

```text
t = 0.2 → 0.3
```

可能移动了 1.5 米。

如果每帧固定增加 `t`，最终自然不会匀速。

### 弧长采样：`getPointAt()`

Three.js 提供：

```ts
curve.getPointAt(u);
```

它会先通过曲线弧长进行映射。

因此可以近似把 `u` 理解成：

```text
u = 0.00  → 起点
u = 0.25  → 曲线总长度的 25%
u = 0.50  → 曲线总长度的 50%
u = 0.75  → 曲线总长度的 75%
u = 1.00  → 终点
```

于是相机路径更适合：

```ts
const position = curve.getPointAt(progress);
camera.position.copy(position);
```

这里有一个非常重要的区分：

> Catmull–Rom 负责让路径的**形状平滑**，而 Arc Length Mapping 负责让沿路径的**运动速度均匀**。

它们是两个不同的问题。

### 用真正的世界速度移动

在实际项目中，比“每秒增加多少 progress”更合理的做法，是直接定义真实空间速度。

例如：

```ts
const speed = 2; // 2 units/s
const length = curve.getLength();

u += (speed * deltaTime) / length;
```

然后：

```ts
camera.position.copy(curve.getPointAt(u));
```

如果整个场景约定：

```text
1 unit = 1 meter
```

那么：

```ts
speed = 2;
```

就可以近似理解为：

```text
2 m/s
```

这种写法会比：

```ts
u += 0.001;
```

更容易调试和维护。

### 提高弧长映射精度

Three.js 的弧长并不是对曲线进行解析积分，而是通过离散采样建立长度映射。

对于比较长或者比较复杂的路径，可以增加：

```ts
curve.arcLengthDivisions = 1000;
curve.updateArcLengths();
```

例如：

```ts
const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');

curve.arcLengthDivisions = 1000;
curve.updateArcLengths();
```

对于几十米甚至上百米的大型 3DGS 或建筑场景，这会让匀速采样更加稳定。

---

## 4. 相机为什么不仅需要一条路径

到目前为止，我们只解决了一个问题：

> Camera Position 应该在哪里？

```ts
const position = curve.getPointAt(u);
```

但完整的 Camera Pose 实际上是：

```text
Position
+
Orientation
```

只知道位置并不能决定镜头在看哪里。

曲线可以提供当前的切线：

```ts
const tangent = curve.getTangentAt(u);
```

这个方向可以作为：

```text
Forward
```

于是最简单的实现是：

```ts
const position = curve.getPointAt(u);
const tangent = curve.getTangentAt(u);

camera.position.copy(position);

camera.lookAt(position.clone().add(tangent));
```

对于简单 Demo，这已经可以工作。

但一个完整的 3D 姿态至少需要：

```text
Forward
Up
Right
```

也就是一套局部坐标系：

```text
             Up
              ↑
              |
              ●────→ Right
             /
            /
        Forward
```

只有 Forward 仍然不能唯一确定相机。

因为即使视线方向完全相同，相机依然可以绕 Forward 轴任意旋转：

```text
              ↻ Roll

Camera ●────────────────→ Forward
```

这就是为什么相机还需要一个稳定的 `Up`。

### 为什么 `lookAt()` 有时会翻转

Three.js Camera 默认使用：

```ts
camera.up.set(0, 1, 0);
```

也就是：

```text
World Y = Up
```

大部分时候这非常合理。

但是，如果曲线突然向上：

```text
Forward ≈ (0, 1, 0)
Up      = (0, 1, 0)
```

就会变成：

$$
Forward \parallel Up
$$

而局部右方向通常来自：

$$
Right=Forward\times Up
$$

当两个向量几乎平行时：

$$
Forward\times Up\approx0
$$

相机的局部坐标系会发生退化。

结果可能表现为：

- 突然翻转
- Roll 跳变
- 上下坡时抖动
- 急弯时姿态异常

所以真正的问题并不是：

> 怎样让相机看向 tangent？

而是：

> 怎样在整个路径上持续构造一套稳定的 Camera Orientation？

---

## 5. 如何得到稳定的相机朝向

对于房间、建筑、街景和大多数 3DGS 场景，我们通常希望一个非常简单的视觉约束：

> 地平线尽量保持水平。

也就是说，相机虽然可以左右转、上下看，但不应该无缘无故产生明显 Roll。

这种情况下，可以直接把世界 Y 轴作为参考：

```ts
const worldUp = new THREE.Vector3(0, 1, 0);
```

然后通过 Forward 和 World Up 构造完整坐标系。

### World Up

首先得到：

```ts
const forward = ...
```

然后计算：

```ts
right.crossVectors(forward, worldUp).normalize();

up.crossVectors(right, forward).normalize();
```

于是得到：

```text
Forward
Right
Up
```

这比单纯调用 `lookAt()` 更明确，因为相机的完整局部坐标系由我们自己控制。

### Quaternion：表示完整姿态

Three.js Camera 默认沿本地 `-Z` 方向观察，所以可以定义：

```ts
back.copy(forward).negate();
```

然后构造旋转矩阵：

```ts
rotationMatrix.makeBasis(right, up, back);
```

再转换为 Quaternion：

```ts
targetQuaternion.setFromRotationMatrix(rotationMatrix);
```

最后应用到相机：

```ts
camera.quaternion.copy(targetQuaternion);
```

在路径系统里，Quaternion 通常比 Euler Angle 更适合，因为它：

- 更适合连续 3D 旋转
- 更方便做姿态插值
- 可以避免很多 Euler Angle 的奇异问题
- 与 Three.js Camera 的内部表示天然兼容

### Slerp：让相机不要瞬间转过去

即使目标 Quaternion 是正确的，也不建议每一帧直接：

```ts
camera.quaternion.copy(targetQuaternion);
```

否则路径方向上的微小变化会被镜头立即响应，画面容易显得机械甚至抖动。

更自然的方式是：

```ts
camera.quaternion.slerp(targetQuaternion, alpha);
```

为了避免旋转速度依赖帧率，可以写成：

```ts
const alpha = 1 - Math.exp(-8 * deltaTime);

camera.quaternion.slerp(targetQuaternion, alpha);
```

这样在 30 FPS、60 FPS、120 FPS 下，阻尼体验会更加接近。

### Look Ahead：不要只看脚下

直接使用当前 tangent 还有一个问题：

> 相机只知道“现在正在朝哪里走”，并不知道路径马上要怎么弯。

实际驾驶者和摄影机通常都会看向前方。

所以可以让相机瞄准路径前方一小段距离，例如 1 米：

```ts
const curveLength = curve.getLength();

const lookAheadDistance = 1;

const lookAheadU = lookAheadDistance / curveLength;

const position = curve.getPointAt(u);

const target = curve.getPointAt(Math.min(u + lookAheadU, 1));

const forward = target.clone().sub(position).normalize();
```

这样：

```text
Camera ●──────────────● Look Ahead Target
        ╲
         ╲
          ╲____ Path
```

相机会在进入弯道之前提前调整视线。

通常能够明显改善：

- 转弯生硬
- tangent 局部变化过快
- 镜头机械跟随
- 小幅抖动

对于普通相机路径来说，Look Ahead 是非常值得加入的一步。

---

## 6. 复杂 3D 路径：Frenet Frame 与 Parallel Transport

固定 World Up 对室内场景非常有效，但并不是所有路径都希望“头顶永远朝世界 Y”。

例如：

- 飞机
- 过山车
- 管道运动
- 太空飞行
- 完整的 3D 环形轨道

在这些情况下，相机的 Pitch、Yaw、Roll 都应该由路径自身决定。

### Frenet Frame

对于一条空间曲线，可以定义：

$$
T,\ N,\ B
$$

其中：

- `T`：Tangent
- `N`：Normal
- `B`：Binormal

并且：

$$
B=T\times N
$$

它们组成曲线当前位置的局部 Frame：

```text
              N
              ↑
              |
              ●────→ B
             /
            /
           T
```

Three.js 可以直接计算：

```ts
const frames = curve.computeFrenetFrames(segments, closed);
```

返回：

```ts
frames.tangents;
frames.normals;
frames.binormals;
```

于是相机的整个局部坐标系都可以跟随曲线变化。

这对于过山车特别自然：轨道翻转时，相机也跟着轨道一起翻转，而不是继续保持世界 Y 朝上。

### 为什么 Frenet Frame 不适合普通室内漫游

如果房间路径只是：

```text
──────╮
      │
      │
```

完整跟随曲线 Frame，反而可能让相机产生不必要的 Roll。

最终画面可能从：

```text
────────
```

慢慢变成：

```text
////////
```

也就是：

> 人在平地上走，但脑袋逐渐歪了。

因此：

```text
路径可以完整控制姿态
```

和：

```text
路径只控制移动方向
```

是两个完全不同的需求。

可以简单归纳为：

| 场景                  | 推荐姿态策略             |
| --------------------- | ------------------------ |
| 房间 / 建筑 / 3DGS    | World Up                 |
| 普通 Cinematic Camera | World Up + Look Ahead    |
| 无人机 / 自由飞行     | Parallel Transport       |
| 飞机 / 过山车         | Frenet / Transport Frame |
| 管道 / 环形轨道       | Frenet / Transport Frame |

### Parallel Transport

World Up 有一个明显边界：

```text
Forward ≈ World Up
```

时会发生退化。

而 Frenet Frame 对普通镜头来说，又可能允许太多 Roll。

Parallel Transport 提供了一个很实用的中间方案：

> 不在每一帧重新计算 Up，而是把上一帧的 Up 通过最小旋转运输到当前帧。

假设已经有：

```ts
prevTangent;
prevUp;
```

当前切线：

```ts
currentTangent;
```

计算：

```ts
const deltaRotation = new THREE.Quaternion().setFromUnitVectors(
  prevTangent,
  currentTangent,
);
```

这代表：

> 把上一帧 tangent 转到当前 tangent 所需要的最小旋转。

然后把相同旋转应用到 Up：

```ts
currentUp.copy(prevUp).applyQuaternion(deltaRotation);
```

最后重新正交化：

```ts
currentUp.addScaledVector(currentTangent, -currentUp.dot(currentTangent));

currentUp.normalize();
```

这样 Up 会随着路径平滑传播，而不是每帧都重新依赖世界坐标轴。

它尤其适合：

- Cinematic Camera
- 无人机镜头
- 有明显上下坡的路径
- 自由 3D 飞行

### 闭环路径

对于闭合轨迹：

```ts
closed = true;
```

还有一个容易忽略的问题：

```text
起点位置 = 终点位置
```

并不意味着：

```text
起点姿态 = 终点姿态
```

如果 Frame 首尾不一致，相机跑完一圈后可能发生一次明显的旋转跳变。

因此赛车轨道、循环飞行这类系统，不仅要保证路径位置闭合，也需要保证：

```text
Orientation Closure
```

这也是闭合路径使用 Frenet/Transport Frame 时必须关注的问题。

---

## 7. 完整实现与工程建议

把前面的内容组合起来以后，会发现 Catmull–Rom 其实只负责整个系统的第一部分。

完整的相机路径更接近：

```text
Waypoints
    ↓
Catmull-Rom
    ↓
Smooth Path
    ↓
Arc Length Mapping
    ↓
Constant Speed
    ↓
Position
    ↓
Look Ahead
    ↓
Forward
    ↓
Up Strategy
 ┌───────┼────────────┐
 │       │            │
World   Parallel     Frenet
Up      Transport    Frame
 │       │            │
 └───────┼────────────┘
         ↓
Rotation Matrix
         ↓
Quaternion
         ↓
Slerp
         ↓
Camera Pose
```

所以更准确地说：

> Catmull–Rom 解决的是 **Path Geometry**，而不是整个 **Camera Motion**。

### 一套适合 Three.js / 3DGS 的基础实现

先创建路径：

```ts
const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');

curve.arcLengthDivisions = 1000;
curve.updateArcLengths();
```

准备复用对象：

```ts
const worldUp = new THREE.Vector3(0, 1, 0);

const forward = new THREE.Vector3();

const right = new THREE.Vector3();

const up = new THREE.Vector3();

const back = new THREE.Vector3();

const rotationMatrix = new THREE.Matrix4();

const targetQuaternion = new THREE.Quaternion();
```

相机更新函数：

```ts
function updateCamera(
  camera: THREE.Camera,
  curve: THREE.Curve<THREE.Vector3>,
  u: number,
  deltaTime: number,
  lookAheadDistance = 1,
) {
  const length = curve.getLength();

  const position = curve.getPointAt(u);

  // 以真实世界距离表示 Look Ahead
  const lookAheadU = lookAheadDistance / length;

  const targetU = Math.min(u + lookAheadU, 1);

  const target = curve.getPointAt(targetU);

  // 终点附近 target 与 position 可能重合
  if (target.distanceToSquared(position) < 1e-8) {
    target.copy(position).add(curve.getTangentAt(u));
  }

  forward.subVectors(target, position).normalize();

  right.crossVectors(forward, worldUp).normalize();

  up.crossVectors(right, forward).normalize();

  // Three.js Camera 默认观察本地 -Z
  back.copy(forward).negate();

  rotationMatrix.makeBasis(right, up, back);

  targetQuaternion.setFromRotationMatrix(rotationMatrix);

  camera.position.copy(position);

  // 帧率无关的旋转平滑
  const alpha = 1 - Math.exp(-8 * deltaTime);

  camera.quaternion.slerp(targetQuaternion, alpha);
}
```

使用真实速度推进：

```ts
const speed = 2;

u += (speed * deltaTime) / curve.getLength();

u = Math.min(u, 1);
```

### World Up 的边界保护

如果路径可能接近垂直方向，应该检测：

```ts
const alignment = Math.abs(forward.dot(worldUp));
```

当：

```ts
alignment > 0.999;
```

时，意味着：

```text
Forward ≈ World Up
```

此时 `forward × worldUp` 已经不稳定。

对于普通室内路径，可以限制路径角度；对于真正自由的 3D 路径，则应该考虑使用上一帧姿态或者 Parallel Transport。

### 不同场景的推荐组合

#### 建筑 / 3DGS / 第一人称漫游

```text
Centripetal Catmull-Rom
        +
getPointAt()
        +
World-space Speed
        +
Look Ahead
        +
World Up
        +
Quaternion
        +
Slerp
```

这是最推荐的默认方案。

#### Cinematic Camera / 无人机

```text
Centripetal Catmull-Rom
        +
getPointAt()
        +
Look Ahead
        +
Parallel Transport
        +
Quaternion Slerp
```

适合路径存在明显高低起伏，同时又不希望 Roll 变化过于激烈的镜头。

#### 飞机 / 过山车 / 完整 3D 轨迹

```text
Catmull-Rom
        +
Frenet / Transport Frame
        +
Quaternion
```

让：

```text
Pitch
Yaw
Roll
```

都自然地随路径改变。

---

## 总结

从表面上看，Catmull–Rom 只是一个“把几个点连成平滑曲线”的算法。

但真正将它应用到 Three.js 相机系统时，会发现一条稳定的 Camera Path 实际涉及多个层次：

```text
控制点
  ↓
曲线形状
  ↓
参数化
  ↓
弧长
  ↓
真实速度
  ↓
朝向
  ↓
Up Strategy
  ↓
Quaternion
  ↓
姿态平滑
```

其中最重要的几个结论是：

1. Catmull–Rom 是插值曲线，控制点本身就在路径上。
2. 普通 Three.js / 3DGS 路径优先使用 `centripetal`。
3. 路径动画优先使用 `getPointAt()` 做弧长采样。
4. 速度最好以世界空间距离定义，而不是直接增加参数 `t`。
5. 相机只有 Forward 不够，还需要稳定的 Up 和 Right。
6. 室内漫游通常保持 World Up，避免不必要的 Roll。
7. Look Ahead 可以显著改善转弯时的镜头体验。
8. Quaternion + Slerp 更适合连续的 3D 姿态变化。
9. 自由 3D 飞行可以进一步使用 Parallel Transport。
10. 过山车、飞机等完整 3D 姿态系统可以使用 Frenet / Transport Frame。

如果需要给一个普通 Three.js / 3DGS 项目选择第一版实现，我会从下面这套组合开始：

```text
Centripetal Catmull-Rom
          +
      getPointAt
          +
  World-space Speed
          +
      Look Ahead
          +
      World Up
          +
     Quaternion
          +
        Slerp
```

它不一定是理论上最复杂的方案，但通常是**稳定性、视觉效果和实现成本之间最好的平衡点**。

---

## 参考资料

- [Three.js `CatmullRomCurve3`](https://threejs.org/docs/#api/en/extras/curves/CatmullRomCurve3)

- [Three.js `Curve`](https://threejs.org/docs/#api/en/extras/core/Curve)

- [Three.js `Quaternion`](https://threejs.org/docs/#api/en/math/Quaternion)

- [Three.js `Camera`](https://threejs.org/docs/#api/en/cameras/Camera)
