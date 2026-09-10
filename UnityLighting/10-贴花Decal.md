# 10 - 贴花（Decal）

## 学习目标

- 理解贴花是「往已有表面上投影材质」，不是再铺一张独立网格贴图那么简单
- 会在 URP 里加贴花渲染器特性（Decal Renderer Feature），并在 DBuffer 与屏幕空间（Screen Space）之间选型
- 能用层（Layer）、角度、距离控制投影，并知道移动端何时改用网格贴花等替代

---

## 1. 原理

贴花把一块材质**投影**到接收表面：弹孔、污渍、路标、积雪边缘都走这条路。核心问题是：投影时去改表面的哪些 G-Buffer / 光照输入。

```
贴花投影器（Decal Projector）
    → 与网格求交（AABB + 角度/距离衰减）
    → 写入反照率 / 法线 / MAOS / 自发光
    → 表面着色仍由原材质完成
```

### 1.1 三种常见技术

| 技术 | 原理 | URP | HDRP |
|------|------|-----|------|
| DBuffer | 在不透明物体着色前写入贴花缓冲，再由表面着色读取 | Renderer Feature 可选 | 默认主力 |
| 屏幕空间（Screen Space） | 用深度（+法线）还原位置，在屏幕上混合 | 可选，更省 MRT | 有屏幕空间路径 |
| 投影器（Projector） | Built-in 时代的额外 Pass，乘一张 Cookie | URP **不推荐**，兼容差 | 不用 |

URP 的 Projector 组件不是现代贴花方案：额外 Draw、排序差、与 SRP Batcher 不友好。新项目用 **Decal Projector + URP Decal Shader / Shader Graph Decal Master**。

### 1.2 DBuffer 与屏幕空间

- **DBuffer**：额外渲染目标存 Albedo、Normal、MAOS。质量高，能稳定改金属度/光滑度；带宽和 MRT 成本高，移动端压力大。
- **Screen Space**：依赖相机深度（Depth Texture），从深度重建法线或读取
  G-Buffer 法线。它省去 DBuffer，但 URP 在该技术下只提供法线混合质量
  （Normal Blend）控制，不提供 DBuffer 的 Surface Data 组合选项；具体可写
  通道还取决于当前渲染路径、URP 版本与贴花 Shader。透明物体通常收不到。

画面外、被挡住的表面无法被「看见」——这和 [屏幕空间光照效果](/UnityLighting/11-屏幕空间光照效果) 是同一类局限。DBuffer 贴花跟几何走，少受「屏幕上看不见」影响，但仍受投影盒范围限制。

### 1.3 法线与 MAOS

MAOS 一般指金属度（Metallic）、环境光遮蔽（Ambient Occlusion）、光滑度（Smoothness，有的实现把 Occlusion 放在同一张里）。贴花可以：

- 只改 Albedo（污渍、涂鸦）
- 改 Normal（弹孔凹陷、地面裂缝）
- 改 MAOS（湿渍变光滑、锈迹降金属度）
- 改 Emission（霓虹、符文）

URP Lit 必须声明接收这些缓冲；不支持贴花的自定义着色器会「投影器在动、表面没反应」。自定义表面如何采样见 [光照模型与阴影](/UnityShader/04-光照模型与阴影)。

---

## 2. 编辑器配置 / 落地步骤

菜单与特性名称随 URP 版本可能写作 Decal、Decals。以 **URP Renderer 资源上的 Renderer Features 列表**为准。

### 2.1 打开 URP 贴花

1. 选中项目使用的 URP Renderer（Forward / Forward+ 资产，不是 Pipeline Asset 本体也要核对 Renderer 列表）。
2. Add Renderer Feature → **Decal**。
3. Technique：Automatic / DBuffer / Screen Space。不确定时先 Automatic，再按真机性能锁定。
4. Max Draw Distance、DBuffer 设置（是否写入 Normal / MAOS）按项目需要勾选；少勾一项就少一份带宽。
5. 创建材质：Shader 选 URP Decal（或 Shader Graph → Decal），指定 Base Map / Normal / MAOS。
6. 场景物体 **Decal Projector**：指定材质、投影盒尺寸、Pivot、Draw Distance、Fade Factor、Angle Fade。
7. 用 Rendering Layer Mask（渲染层）限制「谁接收贴花」，比只靠场景 Layer 更干净。

### 2.2 投影器放置

1. 盒子要**包住**目标表面，法线方向指向表面（默认沿投影器局部轴，版本间 Gizmo 朝向可能不同，以 Scene 视图箭头为准）。
2. 角度淡出（Angle Fade）：贴在地面的足迹应对墙面衰减，避免立面拉花。
3. 距离淡出：盒子很大时边缘用 Fade 而不是突然裁切。
4. 动态弹孔：对象池复用 Projector，或改用网格贴花（见第 4 节）避免每帧 Instantiate。

### 2.3 HDRP 对照

HDRP 在 HDRP Asset 里开 Decal，场景用 Decal Projector。支持贴花层（Decal Layer）、更完整的金属/遮蔽/细节法线混合，以及与延迟/光线追踪材质的配合。URP 没有一对一的「贴花层数量」和 HDRP 同级的透明贴花能力，不要按 HDRP 文档逐项找 URP 开关。

---

## 3. 关键参数

| 参数 | 作用 | 建议 |
|------|------|------|
| Technique | DBuffer / Screen Space | PC 质量优先 DBuffer；中低移动端 Screen Space 或不用系统贴花 |
| Affect Albedo / Normal / MAOS / Emission | 写入通道 | 污渍只开 Albedo；弹孔开 Normal；湿渍开 Smoothness |
| Draw Distance | 投影器裁剪距离 | 与 LOD 一起收，远处污渍直接关 |
| Angle Fade | 按法线夹角衰减 | 地面贴花必开，防墙面拉伸 |
| Scale Mode | 缩放时保持比例或拉伸 | 世界尺寸路标用恒定世界尺度 |
| Rendering Layer Mask | 接收者过滤 | 角色/粒子单独一层，避免脸上网格也被喷漆 |
| Material Opacity / Blend | 混合强度 | 过强会「塑料贴片」，优先纹理 Alpha |

Screen Space 路径还会间接受 **Depth Texture / Opaque Texture** 开关影响，这些在 URP Renderer 或 Camera 上，不在 Projector 上。

---

## 4. 移动端 / PC 性能与替代

贴花成本 ≈ `投影器数量 × 覆盖像素 × 写入通道数`。DBuffer 还有整屏 MRT。

| 档位 | 建议 |
|------|------|
| 移动低端 | **不用** URP Decal Feature；网格贴花或进主纹理 |
| 移动中端 | 少量 Screen Space 贴花；使用简单材质并严格限制 Draw Distance |
| PC | DBuffer + Normal/MAOS；注意 Forward+ 与特性兼容性 |
| HDRP | 系统贴花 + Decal Layer；控制屏幕覆盖率 |

**移动端替代：**

1. **网格贴花（Mesh Decal）**：一小块贴着表面的四边形，深度偏移（Depth Bias）防 z-fighting。成本清晰，合批友好。
2. **烘焙进主贴图 / 地形 Layer**：路标、长期污渍直接画进 Albedo。
3. **第二套 UV + 细节纹理**：角色伤疤用 UV2，而不是运行时投影。
4. **旧 Projector**：仅维护老项目，新内容不要加。

大量重复网格贴花应走 GPU Instancing，见 [GPU Instancing 与程序化渲染](/UnityShader/12-GPUInstancing与程序化渲染)。半透明网格贴花会加重 Overdraw，优化见 [Shader 性能优化](/UnityShader/07-Shader性能优化) 与 [渲染优化与工程实践](/UnityLighting/12-渲染优化与工程实践)。

---

## 5. 常见问题

| 现象 | 原因与处理 |
|------|------------|
| 完全看不见贴花 | Renderer Feature 未加、材质不是 Decal Shader、投影盒没碰到网格、相机剔除层 |
| 只有颜色没有凹凸 | 未勾选 Affect Normal；或 Technique 不支持该通道 |
| 金属/光滑不变 | 未开 MAOS；接收材质非 Lit；DBuffer 通道被关 |
| 边缘拉伸成条 | Angle Fade 过弱；盒子太厚；表面弯曲过大（改网格贴花） |
| 与 MSAA / 深度闪边 | Screen Space + 深度精度。改 DBuffer 或关 MSAA 改 TAA |
| 透明物体没有贴花 | 预期：多数路径只打不透明。透明用网格贴花 |
| 角色也被喷上弹孔 | Rendering Layer / Layer 没分开 |
| 移动端带宽爆炸 | DBuffer 全通道 + 全屏。减通道、减数量，或换网格 |
| 自定义 Shader 无反应 | 未声明贴花关键字 / 未采样 DBuffer。不要假定所有 Shader 自动支持 |

---

## 6. 学习检查点

- [ ] 能对比 DBuffer、Screen Space、旧 Projector 三条路径
- [ ] 能在 URP Renderer 上加 Decal Feature，并用 Projector 打出 Albedo + Normal 贴花
- [ ] 能用角度淡出、距离、渲染层控制「打在哪、不打在哪」
- [ ] 能为主低端机给出网格贴花或烘焙进主贴图的替代方案

---

## 7. 相关教程

- [渲染管线与光照能力](/UnityLighting/01-渲染管线与光照能力)
- [屏幕空间光照效果](/UnityLighting/11-屏幕空间光照效果)
- [渲染优化与工程实践](/UnityLighting/12-渲染优化与工程实践)
- [Shader 性能优化](/UnityShader/07-Shader性能优化)
- [GPU Instancing 与程序化渲染](/UnityShader/12-GPUInstancing与程序化渲染)
- [光照模型与阴影](/UnityShader/04-光照模型与阴影)
