# 02 - 地址、Label 与 Group

## 学习目标
- 分清 Address、GUID、Label、Group 各自用在哪
- 能制定稳定的命名和分组规则
- 理解 Pack Together / Pack Separately 对包体和热更粒度的影响

---

![地址 Label 与 Group](Res/02-地址Label与Group/地址模型.svg)

## 1. 运行时到底用什么当 Key

加载接口接受的「key」可以是：

| Key 类型 | 例子 | 说明 |
|----------|------|------|
| Address 字符串 | `"ui/login"` | 最常用，人可读 |
| 资源 GUID | `"e8f3..."` | 最稳定，改文件名也不变 |
| IResourceLocation | Catalog 查出来的位置 | 批量、高级用法 |
| Label | `"chapter1"` | **一批**资源，不是单个资产 |
| `AssetReference` | Inspector 拖引用 | 编译期约束，少拼错字符串 |

内部真正索引资源的是 **GUID**。Address 只是 GUID 上的别名，可以改，但改了所有硬编码字符串都要跟着改。

---

## 2. Address 怎么起名

不要用默认的 `Assets/Prefabs/Hero.prefab` 这种带路径的地址（一挪目录全挂）。推荐 **业务稳定名**：

```
ui/login_panel
char/player
sfx/ui_click
scene/level_01
config/item_table
```

规则建议：

- 全小写、用 `/` 分层
- 不把版本号写进地址（`hero_v3`）——版本靠 Catalog / Bundle 哈希
- 同一 Address **不要**指两个资源

```csharp
Addressables.LoadAssetAsync<GameObject>("ui/login_panel");
```

---

## 3. Label

一个资源可以打多个 Label。Label 适合：

- 按关卡预下载：`level_02`
- 按语言：`lang_zh` / `lang_en`
- 按模块：`ui` `audio` `config`

```csharp
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;

public class LoadByLabel
{
    public async void LoadChapter1()
    {
        AsyncOperationHandle<IList<GameObject>> handle =
            Addressables.LoadAssetsAsync<GameObject>("chapter1", null);
        IList<GameObject> list = await handle.Task;
        // 用完 Addressables.Release(handle);
    }
}
```

`LoadAssetsAsync` 按 Label 加载时，**该 Label 下所有匹配类型**都会进来。类型过滤靠泛型；Label 里混了 Texture 和 Prefab 时，要用 `LoadResourceLocationsAsync` 先筛类型。

---

## 4. Group 是打包边界

Group = 一组 Addressable 条目 + 一组 Schema（怎么打、打到哪）。

常见拆法（中小型项目够用）：

| Group | 内容 | 路径 |
|-------|------|------|
| `Builtin_Local` | 启动必现：登录 UI、Loading、核心 Shader | Local |
| `UI_Common` | 通用图集、通用 Prefab | Local 或 Remote |
| `Level_01` … | 关卡专属 | Remote |
| `Audio` | 音频 | Remote，可 Pack Separately |
| `Config` | ScriptableObject / 表 | Remote，便于热更数值 |
| `HotfixDll` | 热更 DLL（见第 10 章） | Remote |

原则：

- **一起下载、一起更新**的放一组
- **很少一起用**的不要 Pack Together（否则为了一个特效拖一整个 UI 包）
- 启动最小集放 Local，其余 Remote

---

## 5. BundledAssetGroupSchema：怎么打成 Bundle

Group 上最重要的 Schema 是 **Content Packing & Loading**（`BundledAssetGroupSchema`）。

### 5.1 Bundle Mode

| 模式 | 行为 | 适用 |
|------|------|------|
| Pack Together | 组内打成 **一个** Bundle | 强相关、总是一起加载 |
| Pack Separately | **每个条目**一个 Bundle | 大资源、很少同时用（高清角色） |
| Pack Together By Label | 同一 Label 打成一个 Bundle | 按关卡 Label 分包 |

热更粒度 ≈ Bundle 粒度。Pack Together 改一个图标可能整组都要重新下；Pack Separately 包数量暴涨、HTTP 请求变多。折中：按功能块 Together，超大单资源 Separately。

### 5.2 其它常用项

- **Compression**：LZ4 适合本地（解压快），LZMA 适合远程（更小、解压慢）
- **Include in Build / Paths**：Local vs Remote（第 03 章）
- **Asset Bundle CRC**：远程建议开，防下残包
- **Use Asset Bundle Cache**：远程资源进 Unity Cache

---

## 6. AssetReference

字符串 Key 没有编译检查。UI 槽位、角色槽位更适合：

```csharp
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;

public class SpawnPoint : MonoBehaviour
{
    public AssetReferenceGameObject enemyRef;

    async void Start()
    {
        AsyncOperationHandle<GameObject> handle = enemyRef.InstantiateAsync(transform.position, Quaternion.identity);
        await handle.Task;
        // 销毁时 enemyRef.ReleaseAsset() 或 ReleaseInstance，见第 06 章
    }
}
```

Inspector 里拖 Addressable 资源即可。改 Address 字符串也不影响已序列化的 GUID 引用。

---

## 7. 一个条目可以有多个 Key

同一 Prefab 可以：

- Address：`char/player`
- Label：`player` `chapter1`

加载任意一个能命中的 Key 都可以。批量接口用 `MergeMode` 组合多个 Key（第 05 章）。

---

## 8. 学习检查点

- [ ] 能解释 Address 与 GUID 谁更稳定
- [ ] 能用 Label 做「按关卡预下载」而不是写死几十个地址
- [ ] 能按「一起用 / 一起更」划分 Group
- [ ] 能说明 Pack Together 和 Pack Separately 对热更流量的影响
