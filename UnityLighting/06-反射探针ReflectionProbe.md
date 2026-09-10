# 06 - 反射探针（Reflection Probe）

## 学习目标

- 分清 **Baked / Custom / Realtime** 三种类型及各自的更新策略
- 掌握 **盒体投影（Box Projection）**、**混合距离（Blend Distance）**、**重要性（Importance）**、**锚点（Anchor Override）**
- 理解 URP 对探针混合、分辨率、投影形状的限制，不把 HDRP 的无上限混合或定向盒投影说成 URP 默认能力
- 能制定室内、载具、过场的探针布置与刷新方案

Shader 里如何采样 `unity_SpecCube0` 见 [高级光照与全局光照](/UnityShader/13-高级光照与全局光照)。

---

## 适用条件与版本前提

反射探针在 **Built-in / URP / HDRP** 都存在，但能力不同。本讲以 **URP** 为主。

| 能力 | Built-in | URP | HDRP |
|------|----------|-----|------|
| Baked / Realtime / 按需 API | 是 | 是 | 是 |
| Time Slicing（分面刷新） | 是 | 是 | 是（实现细节不同） |
| Box Projection | 是 | 是 | 是 |
| Oriented Box / 任意朝向盒投影 | 否 | **否** | 是 |
| Sphere Projection | 是 | **否** | 是 |
| 每探针独立分辨率 | 是 | **否**（受 URP Asset 约束更强） | 是 |
| 探针混合 | 每物体最多约 2 个 | Asset 里选 Simple 或 Blend；混合时通常是 **天空 + 1 个局部**，或 **2 个局部（无天空）** | 层级更完整，混合数量更多 |
| Proxy Volume | 否 | **否** | 是 |
| 基于距离的粗糙度 | 否 | **否** | 是 |

URP 中：光滑金属、大理石、湿地、车漆依赖探针；漫反射为主的地面几乎看不出差异。自定义 Lit 要在 Shader 里采样探针，案例思路见 [Shader 实战案例合集](/UnityShader/14-Shader实战案例合集)。

---

## 原理

探针在其包围盒中心（或锚点）把周围环境渲染成 **立方体贴图（Cubemap）**。着色时用反射向量 `reflect(-V, N)` 采样该 Cubemap，并用粗糙度选择 Mip，近似「这一带的环境镜面」。

它不是屏幕空间反射（SSR），也不是光线追踪：

- 视点不在探针中心时，平面反射会「贴错房间」→ 用 **Box Projection** 把反射向量夹到探针 AABB
- 物体跨越两个房间 → 用 **Blend Distance** 在两张 Cubemap 间插值（URP 混合路数有限）
- 动态光源、开门 → Baked 探针不会变，需 Realtime 或脚本 `RenderProbe()`

三种类型：

| 类型（Type） | 数据来源 | 何时用 |
|--------------|----------|--------|
| **Baked** | 烘焙进 Lighting Data | 静态室内、展览关 |
| **Custom** | 指定一张做好的 Cubemap | 天空盒、预渲染 HDRI、过场固定镜头 |
| **Realtime** | 运行时再画六张（或分时） | 载具、破坏后环境大变、镜子房间慎用 |

---

## 编辑器配置步骤

### 1. 创建

**GameObject → Light → Reflection Probe**。用 Box 套住「这一视觉房间」：走廊单独一颗，大厅单独一颗，不要一颗罩整座城。

### 2. 物体侧

Mesh Renderer：**Reflection Probes = Blend Probes / Simple**（Built-in 每物体可选；**URP 以 Asset 全局策略为主**）。Off 则物体不读局部探针。

### 3. URP Asset

打开 URP Asset → **Lighting / Reflections**（分组名因版本而异）：

- 是否 **Reflection Probe Blending**
- Cubemap 尺寸档位（对 Realtime 成本极敏感）
- HDR 探针是否开启（高光溢出更自然，内存更大）

Graphics 质量级可对 Low 关混合、降分辨率。

### 4. 烘焙与预览

Baked 探针随 **Generate Lighting** 更新（也依赖周围物体 Lightmap Static / GI 贡献设置）。Scene 视图可用反射调试模式看 Cubemap 是否黑、是否只映到天空。

### 5. 运行时刷新（Realtime 或按需）

```csharp
using UnityEngine;
using UnityEngine.Rendering;

public class ProbeOnDemand : MonoBehaviour
{
    public ReflectionProbe probe;

    public void RefreshOnce()
    {
        // 按需重绘；返回 renderId，可用 IsFinishedRendering 查询
        probe.RenderProbe();
    }
}
```

把 Type 设为 Realtime，**Refresh Mode = Via Scripting**，只在过场或天气切换时调用，避免每帧六面。

---

## 关键参数

### 类型与更新

| 参数 | 含义 |
|------|------|
| Type | Baked / Custom / Realtime |
| Refresh Mode | **On Awake** 进场景画一次；**Every Frame** 极贵；**Via Scripting** 推荐 |
| Time Slicing | All Faces At Once / Individual Faces / No Time Slicing。分面可把尖峰摊到多帧（URP 支持分面；「一次出齐六面」与 HDRP 选项不完全对称，以 Inspector 为准） |
| Importance | 重叠时优先级；URP 实际仍受「最多混两路」限制，Importance 是仲裁而不是无限叠加 |
| Intensity | 反射亮度倍率，先校正曝光再拧这里 |

### 空间

| 参数 | 含义 |
|------|------|
| Box Size / Box Offset | 影响范围；物体中心（或锚点）在盒外则通常不选这颗探针 |
| **Blend Distance** | 盒内边缘这一圈开始与其它探针/天空混合，避免硬切 |
| **Box Projection** | 把采样方向投影到盒壁，室内墙面、地板反射位置更像「房间」而不是无穷天空球 |
| **Anchor Override** | 指定 Transform 作为「探针选择用的位置」。角色把锚点绑在胸口，避免脚在 A 房间、头探进 B 房间时探针乱跳 |

自定义 Shader 若忽略 Box Projection 矩阵，会与 URP Lit 表现不一致。

### Custom / 烘焙分辨率

Custom 指定 Cubemap 资源。分辨率 128 / 256 对移动端通常够用；512+ 给 PC 英雄资产。URP **不要默认按 HDRP「每探针不同分辨率」去规划**，先看 Asset 全局档。

---

## 实战方案

**静态室内（展厅、住宅）：** 每房间 1 颗 Baked + Box Projection。Blend Distance 取盒短边的 10%～25%，门洞重叠处各缩一点，避免三颗抢权重。墙要 Contribute GI，否则 Baked Cubemap 只有天空。

**开放城镇：** 室外可少探针、关 Box Projection（无限远环境用天空球更对）；店铺门口再放室内探针。Importance：室内 > 室外。

**载具：** 车体锚点用车身中心的子物体。Realtime + Individual Faces + 低分辨率（64/128），或每隔 N 米/N 秒 `RenderProbe()` 一次。不要 Every Frame。

**破坏 / 昼夜：** 昼夜更适合换天空盒 + 少量 Realtime，或准备两套 Custom Cubemap。大规模几何破坏后 Baked 探针会错，过场点名刷新关键探针即可。

**与 APV / Lightmap：** 探针管 **镜面环境**，APV/Lightmap 管 **漫反射间接光**，两者同时要。见 [自适应探针体积（APV）](/UnityLighting/05-自适应探针体积APV)。

**URP 混合策略：** 打开 Blending 后，心理预期是「天空 + 当前局部」或「两个局部」，不要按 HDRP 分层反射去堆 8 颗重叠探针。

---

## 性能分档（移动 / PC）

| 档位 | 建议 |
|------|------|
| 移动 | Baked / Custom 为主；Realtime 至多 1 颗、64～128、分面、脚本刷新；关 Blending 或只在 Mid 开；HDR 探针可关 |
| 主机 | 室内 Baked 256 + Box Projection；载具 Realtime 128 分面 |
| PC | 256～512；Blending 打开；Realtime 仍避免 Every Frame；过场可用 All Faces At Once |

成本粗算：Realtime 一帧六面 ≈ 六次额外场景渲染（有遮挡裁剪）。Time Slicing 降的是峰值，总填充量仍在。透明物体、复杂粒子不要放进探针渲染层：给探针设 **Culling Mask**，去掉 UI、特效、角色（角色用锚点采静态探针即可）。

---

## 故障排查

| 现象 | 排查 |
|------|------|
| 金属像贴了错房间的图 | 开 Box Projection；盒要贴墙，不要比房间大一圈又偏移 |
| 走门时反射突变 | Blend Distance 太小；或 URP 关了 Blending 只能硬切 |
| 角色一转身探针乱跳 | 设 Anchor Override 到稳定骨骼；盒体在门洞处重叠要干净 |
| Cubemap 全黑 / 只有天 | 周围物体没进烘焙；Realtime 的 Culling Mask 把几何剔光；相机剪裁平面过近过远 |
| 帧时间周期性尖峰 | Realtime Every Frame 或 All Faces；改分面或脚本 |
| 与 URP Lit 不一致 | 自定义 Shader 未做 Box Projection / 未读第二探针；见 Shader 专题 |
| 盒是斜的仍想投影 | URP 无 Oriented Box Projection，转盒子或拆房间，不要当 HDRP 用 |

---

## 学习检查点

- [ ] 能按场景选择 Baked / Custom / Realtime，并写出 Refresh Mode 与 Time Slicing 组合
- [ ] 能解释 Box Projection 解决什么视差问题
- [ ] 能用 Blend Distance 与 Importance 处理门洞，并清楚 URP 混合路数上限
- [ ] 能为角色/载具配置 Anchor Override
- [ ] 能在 URP Asset 上打开或关闭探针混合，并给出移动端预算
- [ ] 不会把 HDRP Proxy Volume、定向盒投影当成 URP 现成功能

---

## 延伸阅读

- [05 - 自适应探针体积（APV）](/UnityLighting/05-自适应探针体积APV)
- [07 - 阴影系统与 Shadowmask](/UnityLighting/07-阴影系统与Shadowmask)
- [UnityShader / 13 - 高级光照与全局光照](/UnityShader/13-高级光照与全局光照)
- [UnityShader / 14 - Shader 实战案例合集](/UnityShader/14-Shader实战案例合集)
