---
title: '无人机吊载抑摆：从强化学习到真机验证'
description: '基于 DQN 与 Gym 生成吊载抑摆轨迹，接入 OptiTrack、ROS、MAVROS 与 PX4，在 Jetson Xavier NX 上完成室内真机实验。'
period: '2022.03 — 2023.06'
sortDate: '2023-06'
role: '第一作者 / 科研开发'
kind: 'research'
featuredOrder: 2
technologies: ['DQN', 'PyTorch', 'Gym', 'C++', 'ROS', 'MAVROS', 'PX4']
highlights:
  - '建立二维吊载动力学模型与 Gym 训练环境，设计区域近似探索 DQN 和分区奖励。'
  - '接入 OptiTrack 位姿数据，通过 ROS / MAVROS 连接 Jetson Xavier NX 与 PX4 飞控。'
  - '完成约 250g、500g 两组室内吊载对照实验；500g 工况的峰值摆角绝对值约由 20° 降至 14°，仍存在残余振荡。'
links:
  - label: '项目详情'
    url: '/projects/uav-swing-free-trajectory'
  - label: 'CAC 2022 论文'
    url: 'https://ieeexplore.ieee.org/abstract/document/10055333'
featured: true
cover:
  src: '/assets/projects/uav/uav-platform.jpg'
  alt: '论文中的四旋翼实验平台，机架下方搭载 Jetson Xavier NX 板载计算机'
---

## 项目概览

无人机运输绳索悬挂的负载时，加减速会引发摆动。这个科研项目希望在完成运输任务的同时，降低负载摆动，并让到达目标后的系统尽快稳定下来。

我的研究与开发覆盖动力学建模、强化学习训练、ROS 系统集成和实验分析：先用 Python、PyTorch 与 Gym 学习抑摆轨迹，再将训练得到的策略接入无人机实验平台，通过真实位姿反馈验证效果。项目属于浙江省新苗人才计划，相关算法成果以第一作者发表于 CAC 2022。

本页同时整理了会议论文中的算法与仿真，以及学位论文《基于强化学习的四旋翼无人机-悬挂负载最小摆动轨迹生成》中的系统搭建与真机实验。下文分别列出仿真和实物实验条件，配图沿用学位论文原图号。

## 从训练到飞行的系统链路

整个系统分为本地训练和机载执行两部分。本地计算机运行动力学环境与 DQN 训练；无人机上的 Jetson Xavier NX 运行 Ubuntu 20.04 和 ROS，接收外部定位信息，并与 PX4 飞控通信。

```text
本地训练：动力学模型 + 分区奖励 → Gym 环境 → PyTorch / DQN 策略

真机执行：OptiTrack 获取无人机与负载位姿
                      ↓ 局域网广播 / ROS 订阅
                Jetson Xavier NX
                  ├─ 位姿反馈 → MAVROS → PX4 飞控
                  └─ 策略执行 → 控制指令 → MAVROS → PX4 飞控
```

OptiTrack 分别追踪无人机和悬挂负载。ROS 接收两者的位姿，一方面向飞控提供无人机位置，另一方面为策略提供系统状态；板载计算机与飞控通过串口上的 MAVLink 协议通信，MAVROS 提供 ROS 侧的接口。

<figure>
  <a href="/assets/projects/uav/system-overview.png" target="_blank" rel="noreferrer" aria-label="打开系统原理图原图">
    <img src="/assets/projects/uav/system-overview.png" alt="OptiTrack、无线路由器、上位机与四旋翼构成的室内实验系统" width="1121" height="632" loading="lazy" decoding="async" />
  </a>
  <figcaption>学位论文图 5.5：实验系统原理图。光学动作捕捉提供外部定位，局域网连接定位系统、上位机与机载计算机。点击图片可查看原图。</figcaption>
</figure>

## 建模与强化学习方法

无人机与吊载组成非线性、欠驱动的耦合系统。建模时假设绳索始终绷紧、无弹性形变，将两个垂直平面中的摆动解耦，降低状态维度。单个平面的六维状态包括位置、速度、摆角及摆动角速度：

```text
s = [y, ẏ, z, ż, α, α̇]
```

基于模型构建符合 Gym 输入输出标准的训练环境，用离散动作空间和 DQN 学习轨迹。训练使用经验回放、主网络与目标网络，环境还支持实时查看训练效果和动画展示训练结果。

奖励设计是这个问题的关键。如果只奖励接近目标，策略容易突然加速并放大摆动；过早强调抑摆，又可能让无人机难以完成运输。区域近似探索 DQN 根据距离目标的远近调整奖励权重：远处优先接近目标，进入目标附近后逐步增加摆角约束，引导策略减速和稳定。

仿真在 4 m × 4 m 区域中进行，目标点为 `(2 m, 1 m)`，采用 Python 3.8、PyTorch GPU 与 Gym。训练共 850 回合，累计奖励约在第 600 回合后趋于稳定。训练后的 20 次仿真测试中，负载最大摆角在 16° 以内，最大摆动角速度在 46°/s 以内。这些数值属于仿真结果。

## 真机实验与结果

真机验证在室内约 3 m × 3 m × 1.5 m 的空间内进行。实验使用 Z450 机架、Pixhawk 2.4.8 飞控和 Jetson Xavier NX 板载计算机，OptiTrack 提供位姿数据。受场地高度限制，悬挂绳长从仿真的 1 m 调整为 0.6 m。

对照实验分别使用约 250g 和 500g 的负载，比较 DQN 抑摆轨迹与仅给定目标点、由飞控基础算法生成的轨迹。以下结果来自学位论文报告的室内实验。

<figure>
  <a href="/assets/projects/uav/flight-sequence.webp" target="_blank" rel="noreferrer" aria-label="打开无人机吊载飞行过程原图">
    <img src="/assets/projects/uav/flight-sequence.webp" alt="三个时刻的无人机吊载飞行照片，展示无人机位置与悬挂物姿态变化" width="1455" height="961" loading="lazy" decoding="async" />
  </a>
  <figcaption>学位论文图 5.10：四旋翼无人机与悬挂负载的真实飞行过程。</figcaption>
</figure>

### 250g 设计负载

在约 250g 工况中，抑摆轨迹的摆角维持在 10° 以内，并在到达目标后逐渐接近 0°；无规划轨迹的摆角达到约 12°，到达后仍有持续摆动。轨迹在起步时适度拉升高度、限制水平方向加速度，再在接近目标时减速，减少了加减速对负载的激励。

<figure>
  <a href="/assets/projects/uav/swing-250g.png" target="_blank" rel="noreferrer" aria-label="打开 250g 负载摆角对照曲线原图">
    <img src="/assets/projects/uav/swing-250g.png" alt="250g 负载摆角对比：蓝色抑摆轨迹逐渐稳定，红色无规划轨迹仍有较明显振荡" width="1746" height="1155" loading="lazy" decoding="async" />
  </a>
  <figcaption>学位论文图 5.15：约 250g 负载下的摆角对比。蓝线为最小摆动轨迹，红线为无规划轨迹；横轴为控制步数。</figcaption>
</figure>

### 500g 双倍负载

负载增加到约 500g 后，系统的摆动更难收敛。对照曲线中的峰值摆角绝对值约由 20° 降至 14°；抑摆轨迹在目标点附近仍有约 5° 的残余摆动，未达到设计负载下的稳定程度。

这组实验表明策略在更重负载下仍有抑摆效果，也说明固定模型与训练条件下的策略存在适用范围。

<figure>
  <a href="/assets/projects/uav/swing-500g.png" target="_blank" rel="noreferrer" aria-label="打开 500g 负载摆角对照曲线原图">
    <img src="/assets/projects/uav/swing-500g.png" alt="500g 负载摆角对比：蓝色抑摆轨迹的峰值绝对值小于红色无规划轨迹，两者仍有残余振荡" width="1720" height="1155" loading="lazy" decoding="async" />
  </a>
  <figcaption>学位论文图 5.17：约 500g 负载下的摆角对比。图中负向峰值的绝对值约为 14° 与 20°；该工况仍存在残余振荡。</figcaption>
</figure>

## 从仿真到真机的工程问题

**位姿接入与运行状态。** 实验不仅需要策略，还需要把定位数据、ROS 节点、飞控通信和策略执行串联起来。通过 ROS 订阅无人机与负载位姿，使用 MAVROS 连接飞控，并实时显示位置以检查系统状态，才能判断策略是否在正确的输入条件下运行。

**测量噪声与数据分析。** 位置采样中包含系统误差与飞行抖动，直接差分得到的速度和摆动角速度会出现明显波动。论文同时展示原始计算曲线与拟合曲线，用于分析运动趋势。

**端到端延迟。** 学位论文估计定位广播约有 30ms 网络延迟，机载计算机与飞控通信约为 40ms，策略计算在 5ms 以内，整体延迟约为 80ms。真实系统的时延会改变轨迹跟踪和到达时间，是理想仿真中没有体现的因素。

**实验条件差异。** 真机使用更短的绳索，且存在模型未考虑的摩擦，不能直接把真机与仿真的摆角差异全部归因于算法。评估时需要同时说明绳长、负载和场地条件。

## 当前边界与后续方向

研究已完成动力学仿真与室内真机对照验证。当前边界包括：离散动作影响轨迹平滑性；室内无障碍场景与外部动捕定位限制了环境范围；500g 工况仍有残余摆动。

后续可以在训练中加入通信延迟、测量噪声与负载参数变化，评估连续动作策略，并研究机载感知条件下的室外定位和障碍物避让。

## 论文与图片来源

会议论文：**Deep Reinforcement Learning-based Swing-Free Trajectories Planning Algorithm for UAV with a Suspended Load**。

- 作者：Renjie Li、Fan Yang、Yujia Xu、Weikang Yuan、Qiang Lu
- 会议：2022 China Automation Congress（CAC），6149–6154
- DOI：[10.1109/CAC57257.2022.10055333](https://doi.org/10.1109/CAC57257.2022.10055333)
- IEEE：[查看会议论文](https://ieeexplore.ieee.org/abstract/document/10055333)

真机系统、实验结果与配图来源于本人学位论文《基于强化学习的四旋翼无人机-悬挂负载最小摆动轨迹生成》第五章。封面为原图 5.2，正文使用原图 5.5、5.10、5.15 和 5.17。
