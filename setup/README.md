# 一键迁移工具

把「换电脑后手动装 Git / Node / Obsidian / 插件 / 配 Git 身份」这一整套操作，压成一条命令。

```powershell
git clone git@github.com:Soft-Fang/Whimsical.git
cd Whimsical
powershell -ExecutionPolicy Bypass -File setup\bootstrap.ps1
```

---

## 目录

- [一、解决什么问题](#一解决什么问题)
- [二、快速使用](#二快速使用)
- [三、工作原理](#三工作原理)
- [四、文件结构](#四文件结构)
- [五、配置文件](#五配置文件)
- [六、命令与参数](#六命令与参数)
- [七、设计取舍](#七设计取舍)
- [八、扩展指南](#八扩展指南)
- [九、排错](#九排错)
- [十、已验证](#十已验证)

---

## 一、解决什么问题

Obsidian 的插件装在 **vault 里**（`<vault>/.obsidian/plugins/`），而本仓库的 `.gitignore` 整体忽略了 `.obsidian/`，所以：

> **换电脑后插件全没了，只能一个个重新装。**

这不是配置错误，是刻意的取舍——`.obsidian/` 里的 `data.json` 存着 Git 插件的 Personal Access Token，`workspace.json` 存着机器相关的面板布局，都不适合进仓库。

本工具的思路是：

> 仓库里**不存插件本体**，只存一份**插件清单**（id + 版本 + 是否启用，几 KB 纯文本）。
> 新电脑照着清单把插件从 GitHub Release 下载回来。

同一个思路也顺手覆盖了其他新电脑要做的事（装软件、`npm ci`、配 Git 身份）。

---

## 二、快速使用

### 场景 A：在已配置好的电脑上，采集当前环境

```bash
npm run setup:export
```

它做三件事：

1. 读 `.obsidian/community-plugins.json` → 哪些插件是启用的
2. 读每个插件的 `manifest.json` → 装了哪些、什么版本
3. 查官方索引把插件 id 反查成 GitHub 仓库地址

产出两份文件（同一数据源，用途不同）：

| 文件 | 给谁读 | 内容 |
|---|---|---|
| `setup/config/obsidian-plugins.json` | **脚本**读 | 结构化清单 |
| `docs/Obsidian插件清单.md` | **人**读 | 表格 + 官方页面链接 + 手动安装步骤 |

然后提交：

```bash
git add setup/config/obsidian-plugins.json docs/Obsidian插件清单.md
git commit -m "chore: 更新 Obsidian 插件清单"
git push
```

### 场景 B：在新电脑上还原

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File setup\bootstrap.ps1
```

```bash
# macOS / Linux
bash setup/bootstrap.sh
```

跑之前建议先看一眼它要做什么：

```powershell
.\setup\bootstrap.ps1 -DryRun
```

脚本执行完，**还需要手动做的只有三件**：

1. 用 Obsidian 打开**仓库根目录**作为 vault
2. 在 Obsidian 设置里登录 **Git 插件**（填 GitHub 用户名 + Personal Access Token）
3. 创建 `.env` 并填入 `PRIVATE_PASSWORD`

### 场景 C：只想重新生成文档

```bash
npm run setup:docs
```

手工改了清单里的 `_note` 备注后，用这个刷新 `docs/Obsidian插件清单.md`。

---

## 三、工作原理

```
【老电脑】npm run setup:export
    │
    ├─ 读 .obsidian/community-plugins.json ────→ 哪些插件启用
    ├─ 读 .obsidian/plugins/*/manifest.json ──→ 装了哪些、版本号
    ├─ 查官方插件索引 ────────────────────────→ id 反查 GitHub 仓库
    │
    ├─ 写 setup/config/obsidian-plugins.json  （给脚本）
    └─ 写 docs/Obsidian插件清单.md             （给人）
    │
    │  git push
    ▼
【新电脑】setup/bootstrap.ps1
    │
    ├─ 检查环境 ────────→ 缺 Git / Node / Obsidian 就调 winget（或 brew）装
    ├─ 同步仓库 ────────→ 配 origin、git pull --ff-only
    ├─ 安装依赖 ────────→ npm ci
    ├─ 配置身份 ────────→ git config user.name / user.email
    ├─ 还原插件 ────────→ 按清单从 GitHub Release 下载
    │                     → 写 .obsidian/plugins/<id>/
    │                     → 合并进 community-plugins.json（保留用户已有的）
    └─ 更新 .gitignore ─→ 补 setup/.cache/（自适应，不写重复规则）
```

关于插件下载，有一个容易踩的坑：

> **插件作者普遍把编译产物 `main.js` 放在 `.gitignore` 里，只挂到 GitHub Release 的附件上。**
> 所以从源码仓库 `raw.githubusercontent.com` 抓 `main.js` 通常 404。
> 工具优先走 `github.com/<repo>/releases/latest/download/main.js`，失败才回退到源码。

---

## 四、文件结构

```
setup/
├── bootstrap.ps1              6.6 KB   Windows 入口（winget）
├── bootstrap.sh               5.4 KB   macOS / Linux 入口（brew / apt / dnf / pacman）
│
├── lib/
│   ├── core.mjs              20.6 KB   跨平台核心
│   │                                   · vault 探测    · 插件索引与下载
│   │                                   · 命令执行      · 清单合并
│   ├── bootstrap.mjs         17.8 KB   主编排（上面那套流程）
│   ├── export.mjs             7.9 KB   采集：读 vault → 写清单
│   └── render-docs.mjs        8.8 KB   渲染：清单 JSON → Markdown
│
├── config/
│   ├── profile.json           713 B    ⭐ 目标状态（仓库地址、Git 身份、目录、端口）
│   ├── apps.json              755 B    要安装的软件及包名
│   └── obsidian-plugins.json  2.5 KB   ⭐ 插件清单
│
└── .cache/
    └── community-plugins.json 2.2 MB   Obsidian 官方插件索引（已 gitignore，可随时删）
```

### 为什么核心是 Node 而不是 PowerShell

`.ps1` / `.sh` 只负责**引导**——因为新电脑可能还没有 Node，得先用系统自带的 PowerShell 或 bash 把 Node 装上。

装完 Node 之后，所有真正的逻辑都交给 `lib/*.mjs`：一套代码同时跑在 Windows / macOS / Linux 上，不用维护两份实现。

---

## 五、配置文件

### `config/profile.json` —— 描述「目标状态」

```jsonc
{
  "git": {
    "repoUrl": "git@github.com:Soft-Fang/Whimsical.git",  // 克隆地址
    "defaultBranch": "main",
    "userName": "soft-fang",                              // 自动配置的 Git 身份
    "userEmail": "525962701@qq.com"
  },
  "obsidian": {
    "vaultMode": "repo",          // repo = 仓库根目录就是 vault；external = 另指定
    "vaultPath": "auto",          // auto 或具体路径
    "pluginsManifest": "setup/config/obsidian-plugins.json",
    "offlineAssetsDir": "setup/obsidian/plugins",  // --with-assets 的快照目录
    "installDataJson": false      // ⚠️ data.json 永不写入（防 Token 泄漏）
  },
  "blog": {
    "postsDir": "content/blog",
    "appsDir": "content/apps",
    "privateNotesDir": "content/private",
    "devPort": 4321
  }
}
```

### `config/obsidian-plugins.json` —— 插件清单

```jsonc
{
  "plugins": [
    {
      "id": "obsidian-git",              // 必填：Obsidian 的插件 ID
      "name": "Git",                     // 显示名
      "repo": "vinzent03/obsidian-git",  // GitHub 仓库（省略则查官方索引）
      "version": null,                   // null = 装最新版；也可锁定 "2.39.0"
      "enabled": true,                   // false = 只安装，不写进启用列表
      "installData": false,              // true = 用仓库里的 data.json 初始化（谨慎！）
      "_note": "在 Obsidian 里直接提交推送"  // 备注，会显示在生成的文档里
    }
  ]
}
```

**字段语义**

| 字段 | 说明 |
|---|---|
| `version` | `null` 表示不锁版本，每次装最新 Release。锁了之后**已装且版本一致就跳过** |
| `enabled` | `false` 的插件会被装进 `.obsidian/plugins/`，但不写进 `community-plugins.json` |
| `installData` | 默认 `false`。开启后仅在**目标电脑上不存在** `data.json` 时才写入，不覆盖已有设置 |
| `_note` | 纯注释，只影响生成的 Markdown 文档 |

### `config/apps.json` —— 要安装的软件

```jsonc
{
  "windows": [
    { "id": "Git.Git",           "name": "Git",         "check": "git --version",  "required": true },
    { "id": "OpenJS.NodeJS.LTS", "name": "Node.js LTS", "check": "node --version", "required": true },
    { "id": "Obsidian.Obsidian", "name": "Obsidian",    "check": null,             "required": false }
  ]
}
```

`check` 里写的命令只要**能执行**就跳过安装，不会重复装。`required: false` 的软件装失败也不中止。

---

## 六、命令与参数

### npm 命令

| 命令 | 对应脚本 | 用途 |
|---|---|---|
| `npm run setup` | `lib/bootstrap.mjs` | 还原环境（新电脑） |
| `npm run setup:export` | `lib/export.mjs` | 采集清单（老电脑） |
| `npm run setup:docs` | `lib/render-docs.mjs` | 重新生成插件文档 |

### 引导脚本

```powershell
.\setup\bootstrap.ps1              # Windows
bash setup/bootstrap.sh            # macOS / Linux
```

### 完整参数

| 参数 | 说明 |
|---|---|
| `--dir <路径>` | 仓库落到哪里（默认当前目录） |
| `--vault <路径>` | 指定 Obsidian vault |
| `--repo <url>` | 覆盖 `profile.json` 里的仓库地址 |
| `--git-name <名字>` / `--git-email <邮箱>` | 覆盖 Git 身份 |
| `--dry-run` | 只打印将要执行的操作，不改任何文件 |
| `--force-plugins` | 忽略已装版本，强制重装 |
| `--with-assets` | 把插件本体也快照进 `setup/obsidian/plugins/`（可离线还原） |
| `--offline` | 完全不联网（只用缓存 / 仓库内快照） |
| `--no-pull` | 不执行 `git pull` |
| `--skip-deps` | 跳过 `npm install` |
| `--skip-plugins` | 跳过插件还原 |
| `--no-gitignore` | 不改动 `.gitignore` |
| `--ignore-plugin-failures` | 插件没装全也返回成功（默认返回 1） |
| `--dev` | 配置完成后启动 `npm run dev` |

> 参数同时适用于 `.ps1`、`.sh` 和 `node setup/lib/bootstrap.mjs` 三种入口。

---

## 七、设计取舍

| 决定 | 原因 |
|---|---|
| **只存清单，不存插件本体** | 插件的 `main.js` 动辄几 MB（excalidraw 4.8 MB、realclaudian 4.8 MB、dataview 2.3 MB），进仓库既臃肿又容易冲突 |
| **`data.json` 永不进仓库** | 里面存着 Git 插件的 Personal Access Token、机器绝对路径 |
| **优先从 GitHub Release 下载** | 插件作者普遍把 `main.js` 挂在 Release，源码仓库里没有 |
| **`.gitignore` 规则自适应** | 本仓库已整体忽略 `.obsidian/`，工具就只补 `setup/.cache/` 一行，不写重复规则 |
| **插件装不全时返回非 0** | 不让「一键配置」假装成功——失败要能被发现 |
| **文档由数据生成** | `docs/Obsidian插件清单.md` 从 JSON 渲染，保证「脚本自动装」和「人照着装」永远是同一份清单 |
| **索引带缓存（7 天）** | 官方索引 2.2 MB / 7500 条，每次联网拉太慢；缓存带格式版本号，改了结构会自动失效重拉 |

---

## 八、扩展指南

### 装了一个新插件，想让它跟着同步

最简单：在装插件的那台电脑上跑一次采集，然后提交。

```bash
npm run setup:export
git add setup/config/obsidian-plugins.json docs/Obsidian插件清单.md
git commit -m "chore: 更新 Obsidian 插件清单"
git push
```

手动加也可以——编辑 `setup/config/obsidian-plugins.json`，在 `plugins` 数组里追加一条：

```jsonc
{ "id": "obsidian-calendar-plugin", "repo": "liamcain/obsidian-calendar-plugin",
  "version": null, "enabled": true, "_note": "日历视图" }
```

然后 `npm run setup:docs` 刷新文档。

### 想在另一台电脑装别的软件

编辑 `config/apps.json`，加一条即可。`id` 是 winget 的包 ID（Windows）或 brew 的 formula 名（macOS）：

```jsonc
{ "id": "Microsoft.VisualStudioCode", "name": "VS Code", "check": "code --version", "required": false }
```

### 想让插件断网也能装

在采集时加参数，把插件本体也存进仓库：

```bash
npm run setup:export -- --with-assets
```

它会把 `main.js` / `manifest.json` / `styles.css` 复制到 `setup/obsidian/plugins/<id>/`。
之后新电脑跑 `bootstrap` 时会**优先用仓库里的快照**，抓不到才联网。

> 代价：仓库会变大（12 个插件约 20 MB）。

### 想改 `.gitignore` 规则

规则块由 `lib/bootstrap.mjs` 里的 `buildGitignoreBlock()` 生成，会先探测 `.obsidian/` 是否已被整体忽略，再决定写详细规则还是只写一行。

---

## 九、排错

**Q：插件下载失败，提示「下载失败（作者/仓库）」**

1. **网络问题** —— 插件托管在 GitHub，国内访问不稳定。挂代理后重跑，或设置 Token 提高 API 限额：
   ```powershell
   $env:GITHUB_TOKEN = "ghp_你的token"
   .\setup\bootstrap.ps1
   ```
2. **插件不在官方索引里**（自建或 BRAT 装的）—— 在清单里手工补上 `repo` 字段
3. **版本对不上** —— 把该插件的 `"version"` 改成 `null`，装最新版

**Q：`npm run setup:export` 说「没有可记录的有效插件」**

说明 `vaultPath` 找错了。用 `--vault "路径"` 明确指定，或检查该目录下是否有 `.obsidian/`。

**Q：插件装了但 Obsidian 里看不到**

1. 确认 Obsidian 已关闭「受限模式」（设置 → 第三方插件）
2. 检查 `.obsidian/community-plugins.json` 里有没有该插件的 id
3. 完全退出 Obsidian 再重开（它会缓存插件列表）

**Q：`setup/.cache/` 占了 2.2 MB**

那是官方插件索引缓存，已 gitignore 不会进仓库。删掉即可，下次运行会自动重新拉取。

**Q：插件装不全，脚本返回退出码 1**

这是刻意的。修好后重跑，或加 `--ignore-plugin-failures` 强制返回成功。

---

## 十、已验证

| 验证项 | 结果 |
|---|---|
| 真实联网下载 | ✅ 12 个插件全部成功，`main.js` 均为真实产物 |
| 全新克隆 → 跑脚本 | ✅ 12 个插件装好、启用列表正确、构建通过（18 个页面） |
| 反向采集 | ✅ 从 vault 反查仓库地址与版本号，全部准确 |
| 跨平台脚本 | ✅ `.ps1` / `.sh` / `.mjs` 语法全部通过 |
| Windows `npm` 兼容 | ✅ 修掉了 `.cmd` 无法被 `spawn` 直接执行的问题 |
| 索引降级 | ✅ 网络不可用时自动回退本地缓存 |

---

相关文档：

- [../SETUP.md](../SETUP.md) —— 跨设备写作指南（面向使用者）
- [../docs/Obsidian插件清单.md](../docs/Obsidian插件清单.md) —— 插件表（自动生成）