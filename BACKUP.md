# 备份与恢复

> 这个博客有两类数据：**跟着 git 走** 的和 **只在本机** 的。
> 本文只讲后者——它们不在仓库里，换电脑 / 重装系统会丢。

---

## 一、哪些东西不会跟着 git 走

| 路径 | 内容 | 丢了会怎样 |
|---|---|---|
| `content/private/` | 私有笔记**明文** | 线上密文还在，但**无法再编辑**（只能解出旧内容） |
| `content/study/` | 学习笔记（仅本地） | 笔记丢失 |
| `.obsidian/` | Obsidian 配置 + **已装插件** | 新电脑要重新装一遍插件 |
| `.env` | 私有区密码 | 无法再加密新内容（旧密文也解不开） |
| `维护教程.md`、`content/仪表盘.md`、`Excalidraw/` | 本地辅助文件 | 辅助资料丢失 |

> 反过来，`content/blog/`、`content/talk/`、`content/templates/`、`src/`、`public/`、以及**加密后的** `src/data/private-posts.json` 都在 git 里，`git clone` 就能拿到，不用单独备份。

---

## 二、推荐做法：一键打包备份

仓库里带了脚本 `scripts/backup.ps1`，它会把上面那些「本机独有」的内容打成一个带时间戳的 zip。

### 备份

```powershell
# 默认存到 用户目录\Whimsical-Backup\
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1

# 或指定目录（推荐指定到网盘）
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1 -OutDir "E:\OneDrive\Backup\Whimsical"
```

输出示例：

```
  + content/private
  + content/study
  + .obsidian
  + .env
  + 维护教程.md
  + Excalidraw

备份完成：E:\OneDrive\Backup\Whimsical\whimsical-backup-20260914-100825.zip  (6858.4 KB, 共 6 项)
```

### 建议频率

| 场景 | 频率 |
|---|---|
| 写了几篇私有笔记 / 学习笔记 | 当天跑一次 |
| 平时 | **每周一次**足够 |
| 换电脑 / 重装系统前 | 必须跑一次 |

> 更省事的做法：把 `-OutDir` 指向 **OneDrive / 坚果云 / 百度网盘** 的同步目录，脚本跑完就自动上云了。

---

## 三、在新电脑上恢复

```powershell
# 1. 先把仓库 clone 下来（公开内容）
git clone git@github.com:Soft-Fang/Whimsical.git

# 2. 解压备份包，把内容放回对应位置
Expand-Archive -LiteralPath "whimsical-backup-20260914-100825.zip" -DestinationPath . -Force
```

解压出来的目录结构本来就是按仓库相对路径打包的，直接覆盖到仓库根目录即可：

- `content/private/` → 私有笔记明文回来了
- `.obsidian/` → 插件和配置回来了（重开 Obsidian 就是原样）
- `.env` → 私有区密码回来了

最后验证：

```powershell
npm install
npm run dev
```

打开 http://localhost:4321/Whimsical/ ，确认私有区能正常解锁。

---

## 四、其他备份途径（可选）

| 方式 | 说明 |
|---|---|
| **Obsidian Sync** | 官方付费服务，可只同步 `content/` 这个 vault，跨设备最省心 |
| **网盘同步文件夹** | 把仓库放进 OneDrive / 坚果云 的同步目录，整个仓库自动多端同步（注意别和 git 冲突） |
| **Git 分支存私有明文** | ❌ **不建议**：仓库是 public，私有明文一旦提交就等于公开 |
| **GitHub 私有仓库做镜像** | 可以把 `content/private/` 放到另一个**私有**仓库，用 git 同步更规范 |

---

## 五、注意事项

- 备份包里包含 `.env`（私有区密码）和私有笔记明文，**不要**传到公开的地方。
- 换电脑后 `.env` 里的 `PRIVATE_PASSWORD` 必须和备份里的一致，否则 `npm run encrypt` 会生成不同的密文。
- 如果改了密码，需要重新 `npm run encrypt` 并提交 `src/data/private-posts.json`。