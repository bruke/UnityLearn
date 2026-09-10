# 04 - 光照探针（Light Probe）

## 学习目标
- 会放置光照探针组（Light Probe Group），并理解四面体插值（Tetrahedral Interpolation）
- 能用锚点覆盖（Anchor Override / Probe Anchor）和蒙皮网格（SkinnedMeshRenderer）避免角色「吃错探针」
- 分清静态 Lightmap 与动态探针的分工，并能把探针结果烘进场景
- 会排：发黑、闪烁、室内外跳变、探针埋进墙里

Lightmap 只服务静态网格，见 [光照贴图（Lightmap）](/UnityLighting/03-光照贴图Lightmap)。灯的 Mixed/Baked 见 [实时、烘焙与混合光照](/UnityLighting/02-实时烘焙与混合光照)。球谐存储与 Shader 采样见 [高级光照与全局光照](/UnityShader/13-高级光照与全局光照)。

---

## 1. 先做：角色走开过门不再全黑

场景：已烘焙的室内（墙地面 Contribute GI）、门外阳光、一个未静态的 Capsule 当角色。

### 1.1 建 Light Probe Group

1. `GameObject → Light → Light Probe Group`（路径在部分版本为 `GameObject → Create Empty` 再 Add Component **Light Probe Group**，以组件名为准）。
2. 选中物体，Inspector 进入探针编辑：常见按钮 **Edit Light Probes** / Scene 工具栏的探针编辑开关。名称随版本变化，目标是：能在 Scene 里点选、拖动单个探针球体。
3. 先在房间内放规则网格：例如地面上 2×3、人胸口高度再一层、墙角各一颗。**门外阳光下也要放**，否则角色出门仍插值到室内暗探针。
4. 不要把探针放进墙体碰撞内部。Scene 开 Gizmos，从顶视检查探针是否穿模。

### 1.2 动态物体接收探针

选中 Capsule → Mesh Renderer：

- **Receive Global Illumination = Light Probes**（不要选 Lightmaps）。
- 不要勾 Contribute GI。

`Generate Lighting`。Play 后把 Capsule 从室内拖到室外：间接光应逐渐变亮。若瞬间跳变，是探针太稀或门洞没有过渡探针。

### 1.3 锚点（Anchor Override）

把 Capsule 换成多子网格角色（身体 + 武器）。武器 Renderer 的包围盒可能飞到房间外，插值会错。在角色根或胸部空物体上放一个 Transform，所有 Renderer 的 **Anchor Override**（部分文档称 Probe Anchor）指到它。插值只问这个点落在哪个四面体。

---

## 2. 原理：四面体插值与球谐

烘焙时，每个探针位置存储该点的 **间接光照**（及环境），通常是低阶球谐（Spherical Harmonics）。运行时，Unity 用探针位置做 **Delaunay 四面体剖分**。动态物体锚点落在某个四面体内，用四个顶点的球谐加权混合。

```
锚点 → 所在四面体 → 四探针 SH 插值 → 送到 Renderer / Shader（SampleSH）
```

含义：

- 探针是 **体积采样点**，不是贴花。密度应跟在「光照变化快」的地方，而不是均匀铺满全世界。
- 锚点若在四面体外（组覆盖范围外），会落到最近的四面体或退化结果，表现为突然变暗、变色。
- 大物体（车、Boss）单个锚点代表不了体积两端。传统 Built-in 管线可用
  **光照探针代理体积（Light Probe Proxy Volume，LPPV）**；**URP 不支持
  LPPV**，Unity 6 URP 应改用 [自适应探针体积（APV）](/UnityLighting/05-自适应探针体积APV)，
  旧版 URP 则只能拆分 Renderer、规划多个稳定锚点，或接受单点近似。

Unity 6 URP 的 **自适应探针体积（APV）** 是另一套体素/探针系统，菜单和 Light Probe Group 并存时不要混为一谈。本篇只覆盖传统 Light Probe Group。

---

## 3. 放置规则（比「均匀网格」更重要）

| 区域 | 怎么放 |
|------|--------|
| 可走室内 | 身高方向至少两层（膝、胸/头），水平间距按房间：变化剧烈处加密 |
| 门窗过渡 | 门洞内外各一列，避免一个四面体横跨室内外 |
| 彩色灯光 | 光色变化处加密，否则角色「拖尾色」 |
| 墙后/柱后 | 阴面要有探针，否则角色贴墙仍是阳面间接光 |
| 空中 | 跳跃/飞行玩法才需要第三层；纯地面游戏少放高空点 |
| 封闭盒子外 | 不要把组做成稀薄外壳却让玩家走到外壳外 |

编辑技巧：复制一组「房间模板」探针，比每关手点快。删探针后必须重烘，剖分才会更新。

避免：

- 探针在网格内部（烘焙看到的是物体内部黑色）。
- 两个探针几乎重合（退化四面体，闪烁）。
- 只沿地面放一层：角色头和脚间接光错误，尤其有顶部彩色灯时。

---

## 4. SkinnedMeshRenderer 与角色

蒙皮角色默认用包围盒中心附近的探针采样（实现细节随版本微调），动画时包围盒会抖 → **间接光闪烁**。

处理顺序：

1. 全部 SkinnedMeshRenderer / MeshRenderer 设 Receive = Light Probes。
2. **Anchor Override** 指到骨骼上稳定的点（Hip / Chest），不要指到手持武器。
3. 关闭不必要的 `Update When Offscreen` 造成的巨型包围盒（若你用它保动画），否则锚点未设时盒子可能大到跨房间。
4. 附加武器、头发若单独 Renderer，同样指同一锚点，避免「身体亮、武器黑」。
5. 角色自阴影仍靠实时灯；探针 **不提供** 动态物体之间的精确阴影。

粒子、布料同理：能挂 Renderer 就能指定锚点；做不到就接受近似或改实时灯。

---

## 5. 与 Lightmap 的分工

| | 光照贴图 | 光照探针 |
|--|----------|----------|
| 对象 | 静态 Contribute GI 网格 | 动态或未进图集的网格 |
| 空间 | 表面 texel | 点 + 四面体体积 |
| 细节 | 可表现角落 AO、接触影 | 低频，抹平细节 |
| 移动 | 表面内容固定 | 物体移动时插值变化 |

正确组合：建筑进 Lightmap；角色、载具、可拾取物进探针；静态小石子若极多，可进 Lightmap 或干脆实时+合批，不要为每个石子放探针。

Mixed 灯下：动态物体的 **直射** 仍来自实时灯，探针补的是 **间接**。角色发黑时先看有没有实时灯照到，再看探针。Baked 灯则动态几乎只靠探针吃那盏灯的贡献，室内只有 Baked 灯时探针密度更关键。

---

## 6. 烘焙与编辑器检查

1. 探针改位置、增删后必须 **Generate Lighting**。只改实时灯 Intensity 而不烘，探针间接不会变。
2. Lighting 窗口 / Scene 绘制模式中查找 **Light Probes**、**Tetrahedral** 可视化（Unity 2021+ 较常见；没有该项就靠 Gizmos 显示探针）。确认四面体没有穿过不透明墙。
3. 运行时可用 Frame Debugger 看角色是否走 Light Probe 关键字；Shader 若自定义且未采样 SH，探针再密也没用。URP Lit 默认会采样。
4. 多场景：探针属于场景烘焙数据。Additive 加载时，动态物体可能仍用原场景的组。跨场景移动要测，必要时在加载点重叠放过渡探针，或加载后确保物体落在新场景四面体内。

Built-in 与 URP 都使用 Light Probe Group，概念一致。HDRP 项目还可能并用更现代的探针体积，配置以 HDRP 体积面板为准，不要只复制 URP 组密度。

---

## 7. 常见项目方案

| 项目 | 做法 |
|------|------|
| 手游关卡 | 每房间一套模板探针；门洞加密；角色统一 Chest 锚点 |
| 开放大地图 | 可走道路带状放置，野区稀疏；城镇加密；不要全图 1 米一颗 |
| 载具 | Built-in 可用 LPPV；Unity 6 URP 用 APV；旧版 URP 拆 Renderer/锚点并单独测试车内 |
| 过场动画 | 相机能看到的站位都要有四面体覆盖，避免切镜跳色 |

性能：探针数量对烘焙时间和剖分成本有影响，运行时插值相对便宜。先优化 Lightmap 张数，再谈删探针。移动端优先减少「无玩家区域」的探针。

---

## 8. 常见故障排查

| 现象 | 先查 |
|------|------|
| 动态物体全黑 | Receive 误设 Lightmaps；场景无探针；未烘焙；自定义 Shader 未 SampleSH |
| 走动闪烁 | 无 Anchor，包围盒抖；探针重合；四面体穿过墙导致邻室跳变 |
| 出门瞬间爆亮 | 门洞缺过渡探针；室外探针过少，一个四面体连到太阳点 |
| 贴墙仍很亮 | 墙后没探针；锚点在墙外阳面 |
| 武器和身体亮度不同 | 子 Renderer 未共享 Anchor Override |
| 烘完探针仍像没变 | Auto Generate 关了；改的是另一场景的 Group |
| 探针可视化在墙里 | 挪出几何再烘；内部探针贡献黑 SH |
| Additive 场景跳光 | 物体还在旧四面体；两套环境 Skybox 不一致 |

---

## 学习检查点

- [ ] 能从零添加 Light Probe Group，并在门洞处加密
- [ ] 能用四面体插值解释「为什么锚点在墙里会黑、跨室内外会跳」
- [ ] 能为 SkinnedMeshRenderer 指定 Chest 锚点，并让所有子网格共用
- [ ] 能画出静态 Lightmap 与动态探针的分工表
- [ ] 能按清单排除发黑、闪烁、漏烘三类问题

相关：[渲染管线与光照能力](/UnityLighting/01-渲染管线与光照能力) · [实时、烘焙与混合光照](/UnityLighting/02-实时烘焙与混合光照) · [光照贴图（Lightmap）](/UnityLighting/03-光照贴图Lightmap)。
