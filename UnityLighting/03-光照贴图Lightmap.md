# 03 - 光照贴图（Lightmap）

## 学习目标
- 给网格生成第二套 UV（UV2 / Lightmap UV），并看懂纹素密度（Texel Density）
- 会调 Lightmap Resolution、Padding、物体 Scale In Lightmap、Max Lightmap Size
- 能独立走完一次 Generate Lighting，并定位接缝、漏光、脏点
- 知道烘焙结果存在哪些资源里，避免「场景能亮、出包全黑」

混合模式与静态标记见 [实时、烘焙与混合光照](/UnityLighting/02-实时烘焙与混合光照)。动态物体不要进 Lightmap，用 [光照探针（Light Probe）](/UnityLighting/04-光照探针LightProbe)。Shader 侧采样概念见 [高级光照与全局光照](/UnityShader/13-高级光照与全局光照)。

---

## 1. 先做：一张能看清 texel 的 Lightmap

### 1.1 网格必须有 Lightmap UV

1. 选中模型 FBX → Inspector → **Model / Generate Lightmap UVs**（分组名随导入器版本可能叫 *Geometry* 或 *Meshes*）。勾选后 Apply。
2. 打开 UV 预览：在 Lighting 窗口找 **Baked Lightmaps** 预览，或选物体看 UV Charts。Unity 版本不同入口不同：有的在 Lighting 的 **Lightmap Preview**，有的在 Mesh Renderer 的 UV Charts。认「棋盘/图表」预览，不要死记菜单。
3. 若美术已展开 UV2，可关 Generate，但必须保证 **不重叠、有边距**。引擎生成的 UV2 占用 uv1（着色器里常叫 `texcoord1`），与 uv0 漫反射 UV 独立。

Unity 默认网格（Cube 等）已带 Lightmap UV。自己导的模块化墙最容易忘勾。

### 1.2 打静态并设分辨率

1. 地面、墙 **Contribute GI**，Receive = Lightmaps。
2. Lighting Settings：**Lightmap Resolution** 先用 `20`～`40`（单位：texels per unit）。10 米地面在 20 密度下约 200 texel 边，够看清是否糊。
3. **Lightmap Padding**（物体间）先保持默认（常见 2）；图集内图表边距另见 Mesh Importer 的 **Pack Margin**（Generate Lightmap UVs 展开项）。
4. 点 **Generate Lighting**。完成后 Project 会出现 Lightmap 贴图（常在场景同名文件夹或 `Assets/.../场景名/`），以及 **Lighting Data Asset**。

### 1.3 用棋盘检查密度

Lighting 窗口开启 **Texel Validity / UV Overlap / Baked Lightmap** 一类调试视图（Scene 视图绘制模式里也可能有 *Baked Lightmap*、*Lightmap Overlap*，2019～Unity 6 名称不完全相同）。重叠会标红：这些像素在烘焙时互相污染，运行时就是脏点和接缝。

---

## 2. 原理：UV2、纹素密度、图集

Lightmap 是一张（或一组）记录静态表面辐照的贴图。每个 Contribute GI 的网格用 **UV2** 映射到图集图表（chart）上。

```
世界尺寸 × Lightmap Resolution × Scale In Lightmap ≈ 占用 texel
```

- 密度太低：拐角阴影阶梯、文字感色块。
- 密度太高：图集爆、内存爆、烘焙时间指数上升。
- **Padding / Pack Margin**：相邻图表采样时双线性会读到邻居。边距不够 → 亮色漏到暗缝（漏光）或黑边吃进墙面。

**Directional Lightmap** 额外存主导光方向，URP Lit 才能在烘焙表面上保留法线高光变化。Non-Directional 更省一张贴图，卡通或移动端低配常用。

烘焙是预计算 **可见性 + 传输**。薄板单面、漏洞、模型穿插会导致光线「透过墙」，贴图上就是漏光，不是 Resolution 能彻底救的。

---

## 3. 参数说明（按调参顺序）

### 3.1 导入器（每个 Mesh）

| 参数 | 作用 |
|------|------|
| Generate Lightmap UVs | 自动展开 UV2 |
| Hard Angle | 大于该夹角拆 chart，影响接缝位置 |
| Pack Margin | 图表在 1024 图集里的像素边距；模块化件建议 4～16，以预览不渗色为准 |
| Angle Error / Area Error | 允许的扭曲；过大则 texel 分布不均 |

硬表面建筑：Hard Angle 适中，避免一个 chart 包住锐利拐角导致单侧糊。

### 3.2 物体（Mesh Renderer）

| 参数 | 作用 |
|------|------|
| Scale In Lightmap | 乘在全局 Resolution 上。主角能走近的地面 1.0，远山 0.1～0.25 |
| Stitch Seams | Progressive 下尝试缝合相邻 chart 的接缝（对 UV 对齐的模块化墙有效） |
| Cast Shadows / Receive | 烘焙可见性也看阴影投射；双面材质与 Cast 双面选项影响漏光 |
| Lightmap Parameters | 可挂资源覆盖采样、滤波；大场景给英雄建筑单独资产 |

### 3.3 Lighting Settings（全局）

| 参数 | 作用 |
|------|------|
| Lightmap Resolution | 场景默认密度 |
| Max Lightmap Size | 单张上限；移动端 1024 常见，PC 2048 |
| Lightmap Compression | 开则省内存，可能块状；脏点先关压缩对比 |
| Direct / Indirect Samples | 间接脏点先加 Indirect 和滤波，而不是盲目加分辨率 |
| Filtering | Gaussian / A-Trous / None。过糊是滤波过大；噪点是滤波不够或采样不够 |
| Lightmap Encoding | Quality 里 High/Normal/Low 影响移动端解码精度（`Project Settings → Player` 或 Quality，随版本） |

Progressive GPU 与 CPU 结果应接近，但随机种子、滤波实现可能有细差。出包前固定 Lightmapper 类型。

---

## 4. 烘焙流程（建议写成清单）

1. 锁定场景几何：不要一边烘一边改墙厚度。
2. 环境 Skybox、雾、后处理先定。环境强度会进间接。
3. 灯 Mode 与 Mixed Lighting Mode 定稿，见 [02](/UnityLighting/02-实时烘焙与混合光照)。
4. UV Overlap 视图清零；Overlap 不修就烘，等于烘污染。
5. 低分辨率（如 10）快速烘，看漏光和接缝。
6. 再升到目标分辨率，加采样、开 Stitch。
7. 关 Auto Generate，提交 Lightmap、Lighting Data、Lighting Settings。
8. 进 Play：动态物体应靠探针，不要期望它们有 Lightmap。

多场景叠加（Additive）时：各场景可有自己的 Lightmap，但探针与光照数据跨场景要单独验证，避免加载后「探针还在上一关」。

---

## 5. 常见项目方案

| 场景 | 密度与策略 |
|------|------------|
| 手游主城可走区域 | 地面 15～30，墙 10～20；道具 0.3～0.5 Scale；Max 1024 |
| 主机室内 | 30～50；Directional；英雄资产单独 Lightmap Parameters |
| 模块化套件 | 统一 Pack Margin；墙角用 Stitch；避免每块墙独立极小 UV |
| 地形 | Terrain 自带 Lightmap 尺寸；别和网格用同一套「每单位 40」否则图集爆炸 |

同一关卡尽量一张或少数几张 1024，而不是几十张 256：采样次数和内存都更稳。

---

## 6. 性能与移动端

- 内存：`张数 × 尺寸 × 格式 ×（是否 Directional）`。ASTC/ETC 压缩后仍要算运行时解码。
- 带宽：角色走近高密度墙时，Lightmap 采样和 albedo 一起抢缓存。
- 烘焙时间：分辨率翻倍，面积 texel 约四倍；先修 UV 再加分辨率。
- 移动端优先 Non-Directional 或确认 URP 质量档真的用了 Directional 变体，避免浪费第二张图。
- 不要把 Lightmap 打进错误的 Addressables 分组导致真机丢失；场景依赖的烘焙资源要随场景加载。

---

## 7. 接缝、漏光、脏点（排错）

| 现象 | 原因与处理 |
|------|------------|
| 墙缝一条亮线 | Pack Margin / Padding 不够；UV 重叠；薄墙单面，光线从背面漏。加厚或补背面、封洞 |
| 模块化墙接缝一明一暗 | Chart 拆分 + 滤波；开 Stitch Seams；检查法线是否平滑组不一致 |
| 噪点盐粒 | Indirect Samples 不够；滤波太弱；GPU 烘半途显存不足 |
| 色块脏斑 | 压缩伪影；Overlap；texel 过低却开了强 AO |
| 阴影「漂」在表面外 | 模型与碰撞不一致；Bias 是实时阴影问题，烘焙则查是否烘了错误位置的网格 |
| 全白或全黑贴图 | 灯没 Contribute；Intensity 极端；环境曝光；物体 Scale In Lightmap=0 |
| 编辑器有图真机无 | Lighting Data 未进包；剥离；场景未启用 baked GI |
| UV 预览全挤在角落 | 未 Generate Lightmap UVs；自定义 UV2 未展开 |

漏光不要只加 Resolution：光线穿过几何，密度越高漏得越「清晰」。

---

## 8. 学习检查点

- [ ] 能说明 UV0 与 UV2 分工，并能在导入器勾选 Generate Lightmap UVs
- [ ] 能用「世界尺寸 × 分辨率 × Scale」估计 texel，并解释为何远景要降低 Scale
- [ ] 能区分 Padding/Pack Margin 不足导致的渗色，和几何漏洞导致的漏光
- [ ] 能按「先低分辨率修问题，再提高采样」的顺序出一张干净 Lightmap
- [ ] 知道提交哪些烘焙产物，以及动态物体为什么不该收 Lightmap

下一篇：[光照探针（Light Probe）](/UnityLighting/04-光照探针LightProbe)。
