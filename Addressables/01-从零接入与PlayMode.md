# 01 - 从零接入与 Play Mode

## 学习目标
- 能在空项目中安装 Addressables 并跑通第一次加载
- 分清三种 Play Mode，避免「编辑器能跑、真机不行」
- 认识 Addressables Groups 窗口里必须先碰的控件

---

![从零接入与 Play Mode](Res/01-从零接入与PlayMode/接入与PlayMode.svg)

## 1. 它解决什么问题

AssetBundle 能完成「打包装、下载、加载」，但工程里通常还要自己做：

- 依赖清单（谁依赖谁）
- 引用计数（何时 `Unload`）
- 远程路径与版本目录
- 编辑器下不打包也能预览

Addressables 是 Unity 官方在 Bundle 之上的资源系统。运行时你用 **逻辑地址（Address / Label）** 加载，打包、依赖、下载、缓存由系统处理。

底层仍然是 AssetBundle + Catalog（资源目录）。学 Addressables 不等于可以不懂 Bundle，只是日常代码不再手写 `LoadFromFile`。

和本站其它文档的分工：

| 文档 | 定位 |
|------|------|
| [资源管理 / 03 Addressables 系统](/ResourceManagement/03-Addressables系统) | 选型速览 |
| 本专题 | 从零操作到热更落地 |
| [热更新 / 05 资源热更流程](/HotUpdate/05-资源热更流程) | 自研 `version.json` + AB |

---

## 2. 安装

### 2.1 包名

```
Window → Package Manager → Unity Registry
搜索 Addressables
包名：com.unity.addressables
```

建议记下版本。1.21.x（Unity 2021/2022 常见）与 2.x（较新编辑器）窗口和 Profile 措辞略有差异，**概念相同**：Group、Profile、Catalog、Play Mode Script。

### 2.2 第一次打开会生成什么

安装后打开：

```
Window → Asset Management → Addressables → Groups
```

若尚未初始化，点 **Create Addressables Settings**。工程里会出现类似：

```
Assets/AddressableAssetsData/
├── AddressableAssetSettings.asset
├── AssetGroups/
├── AssetGroupTemplates/
├── DataBuilders/
└── ProfileDataSourceSettings.asset
```

不要把 `AddressableAssetsData` 整目录从版本库排除。Settings、Group、Profile 都要进 Git；`Library/` 下的打包缓存不要提交。

---

## 3. 最小可运行示例

### 3.1 标记资源

1. 在 Project 窗口选中一个 Prefab（例如 `Assets/Prefabs/Cube.prefab`）
2. Inspector 勾选 **Addressable**
3. 地址默认等于资源名，可改成稳定业务名，例如 `prefab/cube`

打开 Groups 窗口，该条目会出现在 **Default Local Group**。

### 3.2 运行时加载

挂到空物体上，进入 Play：

```csharp
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;

public class AddressablesFirstLoad : MonoBehaviour
{
    async void Start()
    {
        AsyncOperationHandle<GameObject> handle =
            Addressables.LoadAssetAsync<GameObject>("prefab/cube");
        GameObject prefab = await handle.Task;

        if (handle.Status == AsyncOperationStatus.Succeeded)
        {
            Instantiate(prefab);
        }
        else
        {
            Debug.LogError(handle.OperationException);
        }

        // 演示用：场景销毁前应 Release，见第 06 章
        Addressables.Release(handle);
    }
}
```

编辑器默认 Play Mode 是 **Use Asset Database**，此时**还没有真正打 Bundle**，也能加载成功。这是便利，也是坑的来源。

---

## 4. 三种 Play Mode

路径：

```
Addressables Groups 窗口 → Play Mode Script
```

| Play Mode | 编辑器行为 | 是否经过 Bundle | 适合 |
|-----------|------------|-----------------|------|
| Use Asset Database | 直接从工程资源加载 | 否 | 日常开发、最快 |
| Use Existing Build | 读已经打好的包 | 是 | 测打包、测远程路径 |
| Simulate Groups | 按 Group 模拟依赖与延迟 | 半模拟 | 1.x 排查分包；2.x 中可能弱化或移除 |

### 4.1 Use Asset Database

- 改 Prefab 立刻生效，不用 Rebuild
- **测不到**：Bundle 拆分错误、远程 URL 配错、Catalog 没更新、重复打包
- 真机/Player **永远不会**走这条路径

### 4.2 Use Existing Build

先执行：

```
Addressables Groups → Build → New Build → Default Build Script
```

产物默认在：

```
Library/com.unity.addressables/aa/<BuildTarget>/
```

以及（若配置了远程）：

```
ServerData/<BuildTarget>/
```

再把 Play Mode 切到 **Use Existing Build**。此时编辑器加载路径与真机更接近。

改了 Addressable 资源或 Group 后必须 **重新 Build**，否则会加载旧包或 Key 找不到。

### 4.3 建议习惯

```
日常写玩法     → Asset Database
提测打包/热更 → Existing Build
出包前         → 真机 + 实际 CDN 或本地 HTTP
```

---

## 5. Groups 窗口要先认识的控件

| 区域 | 作用 |
|------|------|
| Groups 列表 | 每个 Group 通常打成一个或多个 Bundle |
| 条目 Address | 运行时 `LoadAssetAsync` 用的 Key 之一 |
| Labels | 批量加载、按标签下载 |
| Profile | 切换 Local / Remote 路径模板 |
| Play Mode Script | 见上一节 |
| Tools → Analyze | 查重复依赖（第 07 章） |
| Build | 打 Catalog + Bundle |
| Hosting | 本机起 HTTP，给远程 Group 做开发服 |

把 **Default Local Group** 的 `Content Packing & Loading` 里路径先理解为：

- **Local**：进包或进 StreamingAssets，随安装包走
- **Remote**：打到 `ServerData`，运行时按 `RemoteLoadPath` 下载

具体 Profile 变量见 [03 - Profile 与加载路径](/Addressables/03-Profile与加载路径)。

---

## 6. 初始化

多数情况下第一次 `LoadAssetAsync` 会自动 `InitializeAsync`。需要更早拿到 Catalog、或要自定义异常处理时，显式初始化：

```csharp
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;

public static class AddressablesBoot
{
    public static async System.Threading.Tasks.Task InitAsync()
    {
        Addressables.InternalIdTransformFunc = null; // 需要改 URL 时再赋值
        AsyncOperationHandle handle = Addressables.InitializeAsync();
        await handle.Task;
        if (handle.Status != AsyncOperationStatus.Succeeded)
            Debug.LogError(handle.OperationException);
    }
}
```

`InitializeAsync` 会读本地（或远程）Catalog，之后 Key 才能解析到 Bundle。

---

## 7. 常见第一天问题

| 现象 | 原因 | 处理 |
|------|------|------|
| `InvalidKeyException` | 地址写错、未勾选 Addressable | Groups 里核对 Address |
| 编辑器正常、包里失败 | 一直用 Asset Database，从未 Build | Existing Build + Player 各测一次 |
| 改资源不生效 | Existing Build 未重打 | New Build 或更新流程（第 08 章） |
| 类型不对 | `LoadAssetAsync<Texture>` 去加载 Prefab | 泛型与资源类型一致 |

---

## 8. 学习检查点

- [ ] 能安装包、生成 Settings、给一个 Prefab 设地址并加载出来
- [ ] 能说出三种 Play Mode 各自测到什么、测不到什么
- [ ] 知道改资源后，Existing Build 必须重新打包
- [ ] 不把 `Library` 当发布目录提交进 Git
