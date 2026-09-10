# 05 - 自适应探针体积（Adaptive Probe Volumes，APV）

## 学习目标

- 分清 **APV** 与传统 **光照探针组（Light Probe Group）**：采样粒度、布置方式、流式加载
- 能在 **URP（Unity 6 / URP 17+）** 中启用 APV、建立 **烘焙集（Baking Set）**、放置体积并完成烘焙
- 理解 **Probe Volumes Options**、分区（Brick / Cell）与 **Streaming**，避免把 HDRP 独有能力当成 URP 标配
- 能按项目版本决定：继续用手摆探针，还是升级到 APV

---

## 适用条件与版本前提

| 环境 | APV 能力 | 建议 |
|------|----------|------|
| Unity 2021.2+ **HDRP** | 实验 → 逐步可用 | 早期文档多写 HDRP，不要照搬到 URP |
| Unity 2022.3 LTS **URP** | **无**生产级 APV | 继续用 Light Probe Group |
| Unity 2023 部分版本 HDRP | APV 较完整 | URP 仍不要默认当成已支持 |
| **Unity 6.0+ / URP 17+** | URP 上 **稳定可用** | 本讲默认以此为准 |
| Built-in RP | 不支持 | 用传统探针 |

管线对照（Unity 6 官方功能表，摘要）：

| 能力 | Built-in | URP 6.0 | HDRP |
|------|----------|---------|------|
| 探针体积：逐像素间接光 | 否 | 是 | 是 |
| 探针体积：逐顶点 | 否 | 是 | 否 |
| 场景混合 / Lighting Scenario | 否 | 是 | 是 |
| 磁盘流式（Disk Streaming） | 否 | 是（含低端非 Compute 路径） | 是 |
| Sky Occlusion | 否 | 是 | 是 |
| 反射探针归一化（Reflection Probe Normalization） | 否 | **否** | 是 |

**结论：** APV 在 Unity 6 的 URP 里是正式功能，但仍缺部分 HDRP 细节（例如反射探针归一化）。2022 URP 工程不要指望菜单里出现完整 APV。

相关 Shader 原理见 [高级光照与全局光照](/UnityShader/13-高级光照与全局光照)。

---

## 原理

传统 Light Probe Group：美术在空间中摆点；运行时每个 **物体（GameObject）** 取周围探针做一次球谐（SH）插值，整件物体共用一个间接光。车身拆成多个 Mesh 时，容易出现「每块颜色不一致」的接缝。

APV：Unity 按几何密度自动填充三维 **砖块（Brick）**。默认每个 Brick 是 **4×4×4 = 64** 个探针。几何密的室内用小 Brick（间距可到约 1 m），空旷室外用大 Brick（9 m / 27 m 量级）。着色时 **每个像素** 取最近 8 个探针插值，间接光更连续。

数据组织：

```
Baking Set（烘焙集，同时只能有一个 Active）
  ├─ 若干 Scene（可勾选是否参与本次 Bake）
  ├─ 共享数据：细分、探针位置
  └─ Lighting Scenario（光照情景）：各情景的探针辐照度
        情景可切换 / 混合（日夜），几何被挪走则不能安全混合
```

流式加载以 **Cell（单元，若干 Brick 的集合）** 为单位：摄像机视锥附近的 Cell 进 GPU，远处卸载。数据集可以大于显存。

---

## 编辑器配置步骤

### 1. 在 URP Asset 里切换探针系统

1. **Edit → Project Settings → Quality**，双击当前质量对应的 URP Asset
2. **Lighting → Light Probe Lighting → Light Probe System** 设为 **Adaptive Probe Volumes**
3. 需要情景混合时，在同一区域勾选 **Lighting Scenario Blending**（名称以你安装的 URP 版本为准）

未切换系统时，场景里即使有 APV 物体也不会按 APV 采样。

### 2. 放置体积

1. **GameObject → Light → Adaptive Probe Volume**
2. Inspector 里 **Mode = Global**（覆盖整场景，新手默认）
3. 大世界可再放 **Local** 体积，提高局部密度

### 3. 物体与灯光

- 灯光要进烘焙间接光：**Mode = Mixed 或 Baked**（纯 Realtime 不进 APV 间接项）
- 对 GI 有贡献的静态网格：**Contribute Global Illumination** 勾选
- 接收探针间接光：**Receive Global Illumination = Light Probes**（不要误设成 Lightmaps 却又没 UV2）

### 4. Lighting 窗口

1. **Window → Rendering → Lighting**
2. **Scene** 页：**Baked Global Illumination** 打开
3. **Adaptive Probe Volumes** 页：
   - **Baking Mode = Single Scene**（单场景）或 **Baking Set**（多场景合烘）
   - **Generate Lighting** 全烘；下拉可选 **Bake Probe Volumes** 只烘 APV（Unity 6）
4. 若 Baking Set 内没有任何 APV，Unity 会询问是否自动创建一个

### 5. 运行时采样（不影响烘焙）

场景中加 **Volume**，Override **Probe Volumes Options**：只改摄像机进入该 Volume 后的采样方式（偏置、噪声、强度），**不改变**探针布局。

---

## 关键参数

### Baking Set / Lighting 面板

| 参数 | 作用 |
|------|------|
| Baking Mode | Single Scene 自动每场景一套；多场景必须并进同一个 Baking Set |
| Min Probe Spacing / 密度相关 | 控制最密 Brick 间距；过密体积暴涨、过疏漏光 |
| Virtual Offset | 把落在墙内的探针沿法线推到空腔，减轻「黑斑」 |
| Dilation / 无效探针膨胀 | 用邻居有效探针填补无效点 |
| Lighting Scenarios | 多套日夜数据；几何布局必须一致才能混合 |

### Adaptive Probe Volume 物体

| 参数 | 作用 |
|------|------|
| Mode Global / Local | 全局覆盖 vs 局部加密 |
| Size / Override Renderer List | Local 范围；可限制参与细分的物体 |
| Probe Spacing Override | 局部比 Baking Set 更密或更疏 |

### Probe Volumes Options（Volume Override）

| 参数 | 作用 |
|------|------|
| Normal Bias / View Bias | 沿法线或视线把采样点推出表面，减漏光 |
| Sampling Noise | 打散量化条带；可动画化噪声 |
| Intensity Multiplier | 运行时整体缩放间接光（调氛围，不替代重烘） |
| Min Distance Between Probes（采样侧） | 限制过近采样，减轻闪烁 |

### Streaming（URP Asset → Lighting）

| 参数 | 注意 |
|------|------|
| Enable GPU Streaming | CPU 内存 → GPU；大世界先开这个 |
| Enable Disk Streaming | 磁盘 → CPU；必须先开 GPU Streaming |
| Probe Volume Disable Streaming Assets | 数据不当 Streaming Assets，才能打进 AB/Addressables；**会关掉 Disk Streaming**，当前 Baking Set 更倾向整包驻留 |

---

## 实战方案

**中小关卡（单场景）：** Global APV + Single Scene + 不启用 Disk Streaming。烘焙后用 Rendering Debugger 看 **Display Probes / Bricks**，室内过黑再局部 Local 加密或 Probe Adjustment Volume 把错误探针标无效。

**多场景叠加（Additive）：** 把所有同时加载的场景放进 **同一个 Baking Set**，只勾选要烘的 Scene。记住：**同一时刻只能有一个 Active Baking Set**。

**日夜切换：** 开 Lighting Scenarios，分别烘「白天 / 夜晚」。运行时用 `ProbeReferenceVolume` 切情景或 `BlendLightingScenario`。只换间接探针数据，直射光、物体位置仍要你自己脚本同步。

**大世界：** GPU + Disk Streaming；Cell 按视锥加载。热更包体若走 Addressables，按官方开关把 APV 从 Streaming Assets 挪出再打包，并重新评估内存。

**与 Light Probe Group 共存：** 不要混用两套作为同一物体的主方案。升级时重烘 APV，删除旧 Group。无法把 Group **一键转换成** APV。手工四面体布置见 [光照探针（Light Probe）](/UnityLighting/04-光照探针LightProbe)。

Shader 侧仍是 SH / 探针贴图采样，自定义光照可参考 [Shader 实战案例合集](/UnityShader/14-Shader实战案例合集) 里对间接光的用法，但 APV 布局本身在 Lighting 窗口完成。

---

## 性能分档（移动 / PC）

| 档位 | 建议 |
|------|------|
| 中低端移动 | Unity 6 URP 可用 APV，优先 **逐顶点**（若质量级提供）或降低密度；**关 Disk Streaming** 若关卡已能整包进内存；Scenario 混合每帧 Cell 数拧小 |
| 高端移动 / 主机 | 逐像素 + 中等 Min Spacing；Streaming 开 GPU，Disk 按包体决定 |
| PC | 逐像素、室内加密、可开 Scenario Blending 与 Sky Occlusion；用 Debugger 盯 Cell 数量和 GPU 池 |

APV 吃的是 **探针数据带宽与采样 ALU**，不是 Lightmap 分辨率。密度翻倍，内存接近立方增长，先改 Local 体积而不是全局最小间距。

WebGL：较新的 Unity 6.x 会对不支持路径给出明确错误，移动 Web 不要把 APV 当默认。

---

## 故障排查

| 现象 | 排查 |
|------|------|
| 菜单没有 APV / URP 不支持 | 版本是否 2022 URP；Asset 是否仍为 Light Probe Group 模式 |
| 动态物体全黑或过亮 | Receive GI 是否 Light Probes；是否未 Generate Lighting |
| 接缝、色块 | 仍在用 Group 的逐物体采样；或 Brick 太稀 |
| 墙内黑斑、漏光 | Virtual Offset、Dilation、Probe Adjustment Volume、Options 里 Bias |
| 多场景一半没间接光 | 不在同一 Baking Set，或 Bake 勾选未打上 |
| 日夜混合花屏 | 两次烘之间挪了几何，共享细分不一致 |
| 真机间接光丢失 | Streaming Assets 未进包；或 Disable Streaming Assets 后未把数据打进 Addressables |
| 编辑器越用越卡（多场景） | Unity 6.2+ 修过 APV 编辑器内存；先升级再查泄漏 |

可视化：**Window → Analysis → Rendering Debugger → Probe Volumes**（路径因版本略有出入）。

---

## 学习检查点

- [ ] 能说明 APV 逐像素 vs Light Probe 逐物体，以及 Brick/Cell 是什么
- [ ] 能在 URP 6 的 Asset 上切换 Light Probe System 并完成一次 Bake Probe Volumes
- [ ] 能配置 Baking Set、说明为何多场景必须合集
- [ ] 能区分 Probe Volumes Options（运行时采样）与烘焙密度设置
- [ ] 能按大世界需求打开 GPU/Disk Streaming，并知道 Addressables 时的 Disable Streaming Assets
- [ ] 清楚 2022 URP 没有该能力，且 HDRP 的反射探针归一化不等于 URP 已有

---

## 延伸阅读

- [04 - 光照探针（Light Probe）](/UnityLighting/04-光照探针LightProbe)（手工探针与本讲对比）
- [06 - 反射探针（Reflection Probe）](/UnityLighting/06-反射探针ReflectionProbe)
- [UnityShader / 13 - 高级光照与全局光照](/UnityShader/13-高级光照与全局光照)
- [UnityShader / 14 - Shader 实战案例合集](/UnityShader/14-Shader实战案例合集)
