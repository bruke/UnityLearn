# 07 - 阴影系统与 Shadowmask（Shadowmask）

## 学习目标

- 掌握 URP **主光阴影** 的距离、级联、分辨率、Bias / Normal Bias、软阴影
- 理解 **Mixed + Shadowmask**（以及 Distance Shadowmask 行为）如何把静态影与动态影拼在一起
- 能配置 **额外光（Additional Lights）** 的阴影预算，避免「点光一开全场掉帧」
- 能处理漏光、悬浮（Peter Panning）、acne 等常见伪影

阴影在 Shader 里如何采样见 [光照模型与阴影](/UnityShader/04-光照模型与阴影)；间接光配套见 [高级光照与全局光照](/UnityShader/13-高级光照与全局光照)。

---

## 适用条件与版本前提

本讲以 **URP** 为准。Built-in 也有 Shadowmask，面板在 Lighting 窗口；HDRP 另有接触阴影、缓存阴影、PCSS 等，**不要把 HDRP 阴影功能表抄到 URP 项目**。

| 项目 | URP 情况 |
|------|----------|
| 主光 Shadow Map + 级联（CSM） | 有，方向光 |
| 软阴影 | Asset 里 Soft Shadows；质量分档 |
| Mixed 模式 | Baked Indirect / Shadowmask / Subtractive |
| Additional Lights 阴影 | 有，但有 **数量与分辨率预算**；低端可关 |
| 面积光软影、屏幕空间接触影 | 不是 URP 默认等价物（接触影常用额外 Pass / 资源商店） |
| 与 APV | Shadowmask 管直射遮挡；APV 管间接；见 [APV](/UnityLighting/05-自适应探针体积APV) |

Unity 版本：2021/2022 URP 已具备主光级联与 Shadowmask；额外光阴影在后续 URP 中预算更清晰。以你工程的 **URP Asset → Shadows / Lighting** 实际字段为准。

---

## 原理

实时阴影：从光源画一张（方向光则多张级联）深度图。着色时把世界坐标变到光源空间，比较深度。失败原因几乎总是 **精度、Bias、级联边界、距离裁剪**。

**Shadow Distance：** 超过该距离不再画实时影，远处物体要么没影，要么改吃烘焙影。

**级联（Cascades）：** 把摄像机视锥按距离切成 1/2/4 块，近处 texel 小、远处 texel 大。级联交界处可能出现接缝，用 Cascade Border 过渡。

**Bias：** 沿光线把接收点推离表面，减自遮挡斑点（Shadow Acne）。推过头，影与物体分离，像浮在空中（**Peter Panning**）。

**Normal Bias：** 沿法线缩小阴影投射体，减轻细长物体、坡面 acne；过大则影变瘦、墙角漏光。

**软阴影：** PCF 等多tap 比较，边缘模糊。质量与 tap 数绑定，移动端先降软影再降级联。

**Mixed 光 + Shadowmask：**

- 静态物体之间的遮挡烘进 **Shadowmask**（或 Subtractive 的暗化）
- 动态物体仍用实时 Shadow Map
- **Shadowmask 模式：** 静态接收者多用烘焙影，动态物体投实时影
- **Distance Shadowmask：** 在 Shadow Distance **以内**，静态物也可以改用实时影（更准、更贵）；以外退回烘焙 mask

Subtractive 更旧、对比度死、彩色间接差，新品优先 **Baked Indirect 或 Shadowmask**。

---

## 编辑器配置步骤

### 1. URP Asset → Shadows

1. 打开当前质量的 URP Asset
2. **Shadows**：Max Distance、Cascade Count、Cascade Split、Depth/Normal Bias、Soft Shadows、Shadow Resolution（主光 / 额外光可能分栏）
3. 主光阴影分辨率常见 1024 / 2048 / 4096；移动端 1024 或分层 512

### 2. 主方向光

- **Mode = Realtime**：全实时影，无烘焙遮挡通道
- **Mode = Mixed**：配合 Lighting 窗口的 Lighting Mode
- Cast Shadows 打开；Culling Mask 不要误关地形层

### 3. Lighting 窗口（Mixed）

**Window → Rendering → Lighting → Mixed Lighting：**

- 勾选 Baked Global Illumination
- **Lighting Mode = Shadowmask**（或 Baked Indirect：静态不投实时影给静态，只烘间接）

静态 Mesh：**Contribute GI** + 合理 Lightmap UV。动态物体不要 Contribute GI。

### 4. 额外光

点光 / 聚光 **Additional Light**。URP Renderer / Asset：

- Additional Lights：**Per Pixel** 才谈得上像样的实时影
- Cast Shadows：按版本可能是 Off / Shadowmask / All
- **Max Additional Lights Shadow**（名称因版本而异）：同时投阴影的额外光上限，例如 1～4

点光阴影是立方体六面（或 Dual Paraboloid 一类近似，以当前 URP 实现为准），成本远高于一盏聚光。URP **不会**像 HDRP 那样提供完整的缓存阴影图集与面积光 PCSS；多盏动态点光请改烘焙、假影贴花，或只给「玩家手电」开阴影。

Lighting Mode 与 Mixed 直射/间接分工见 [实时、烘焙与混合光照](/UnityLighting/02-实时烘焙与混合光照)。

### 5. 每物体

Renderer：**Cast Shadows On / Two Sided / Shadows Only**。植被常用 Two Sided。极小装饰可关投射，减 Shadow Map 填充。

---

## 关键参数

| 参数 | 作用与调法 |
|------|------------|
| Shadow Distance | 先定玩法视距。过大则级联被拉伸，近处糊、远处闪 |
| Cascade Count | 移动 2；主机/PC 4。1 级联等于没切分 |
| Cascade Splits | 把 80% 分辨率留给玩家 10～20 m 内 |
| Shadow Resolution | 锯齿优先加分辨率或加级联，不要只加 Distance |
| Depth Bias | acne → 略增；悬浮 → 略减。主光与额外光分开调 |
| Normal Bias | 墙角漏光先减；acne 再略增。改网格法线比盲目加 Bias 更治本 |
| Soft Shadows | 开了要选 Quality；Low 可能接近硬边 |
| Shadowmask / Distance Shadowmask | 质量设置里可能还有「远处是否仍实时」。PC 开 Distance，移动用普通 Shadowmask |
| Additional Light Shadow Resolution | 聚光可略高，点光六面极贵，能不用实时影就用烘焙 |

自定义 Shader 漏乘主光 shadowAttenuation 会出现「有灯无影」，案例与 Lit 对照见 [Shader 实战案例合集](/UnityShader/14-Shader实战案例合集)。

---

## 实战方案

**移动写实小镇：** Mixed 方向光 + Shadowmask；Shadow Distance 40～80 m；2 级联；主光 1024；额外光阴影全关或只留一把手电筒。静态建筑吃 mask，角色吃实时影。

**PC 室内：** Distance Shadowmask，让窗框近处实时影贴合动画窗帘；Distance 仍要设上限。4 级联 + 2048。聚光灯阴影最多 1～2 盏「英雄灯」。

**夜城霓虹：** 主光可弱，但阴影预算仍在主光上；霓虹用 Baked/Mixed 不投实时影。不要 8 盏点光 All Shadows。

**漏光墙缝：** 先封几何（墙要有厚度）；再减 Normal Bias；Shadowmask 缝检查 Lightmap 缝与探针。实时级联接缝调 Split 与 Border。

**角色悬浮影：** 脚底 acne 与悬浮要分开看：acne 出在自身表面，悬浮是影整体离脚。先把 Bias 降到 acne 刚消失，再用角色专用接触方案（贴花/额外低平面），不要为角色把全场景 Bias 拧到漏光。

**与体积光：** 体积光要采阴影才有丁达尔，见 [体积雾与体积光](/UnityLighting/08-体积雾与体积光)。阴影关了，光轴会穿透墙。

---

## 性能分档（移动 / PC）

| 档位 | 主光 | 额外光影 | Mixed |
|------|------|----------|--------|
| 低端移动 | Distance 短、2 级联、512～1024、软影关 | 关 | Shadowmask 或仅 Baked Indirect |
| 高端移动 | 1024～2048、2 级联、软影 Low | 0～1 盏聚光 | Shadowmask |
| PC | 2048～4096、4 级联、软影 High | 1～4 按关卡 | Distance Shadowmask 可选 |

额外监控：ShadowCaster Pass 的 Draw Call、级联次数（4 级联 ≈ 方向光阴影 pass×4）、点光阴影的立方体贴图更新。Profiler 里看 **Shadows.RenderShadowMap**。

---

## 故障排查

| 现象 | 原因与处理 |
|------|------------|
| 表面斑点（Acne） | Bias 太小、网格交叉、法线差；略增 Bias 或修模 |
| 影离脚/离墙（Peter Panning） | Bias / Normal Bias 过大；或级联过稀导致 texel 撑开 |
| 远处没影 | 超出 Shadow Distance；Shadowmask 未烘或 Lighting Mode 不对 |
| 静态有影、动态没影 | 动态没 Cast Shadows；Mixed 光被当成 Baked |
| 动态有影、静态交界错 | 应用 Shadowmask 却没重烘；或 Distance Shadowmask 在品质里被关 |
| 墙角漏一条光 | 墙无厚度；Normal Bias 大；Lightmap 缝 |
| 级联处一条带 | 调 Cascade Split / Border；避免 Distance 过大 |
| 点光一开帧崩 | 额外光阴影数量超预算；改烘焙或关 Cast Shadows |
| Shader 无影 | 未 include Shadows.hlsl、未 `_MAIN_LIGHT_SHADOWS` 变体 |

---

## 学习检查点

- [ ] 能说明 Shadow Distance 与级联如何分配 texel
- [ ] 能独立调节 Depth Bias 与 Normal Bias，并识别 acne vs 悬浮
- [ ] 能配置 Mixed + Shadowmask，并说出与 Distance Shadowmask、Subtractive 的差别
- [ ] 能给额外光设定阴影上限，并解释点光阴影为何贵
- [ ] 能列出移动/PC 各一档参数起点
- [ ] 自定义 Shader 能接上主光阴影衰减

---

## 延伸阅读

- [08 - 体积雾与体积光](/UnityLighting/08-体积雾与体积光)
- [06 - 反射探针（Reflection Probe）](/UnityLighting/06-反射探针ReflectionProbe)
- [UnityShader / 04 - 光照模型与阴影](/UnityShader/04-光照模型与阴影)
- [UnityShader / 13 - 高级光照与全局光照](/UnityShader/13-高级光照与全局光照)
- [UnityShader / 14 - Shader 实战案例合集](/UnityShader/14-Shader实战案例合集)
