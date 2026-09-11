# 跨设备写作 / 新电脑搭建指南

> 目标：在任意一台新电脑上 **5 分钟跑起来**，写完 `git push` 就自动发布。

---

## 一、新电脑需要装什么

| 软件 | 版本要求 | 用途 |
|---|---|---|
| **Git** | 较新版本即可 | 拉取 / 提交代码 |
| **Node.js** | **≥ 22.12**（推荐 22 LTS 或 24） | 运行 Astro |
| **Obsidian** | 最新版（可选） | 写作编辑器 |

> 装 Node 时记得勾选“Add to PATH”，装完终端执行 `node -v` 能看到 `v22.x` 以上即可。

---

## 二、一次性搭建（每台新电脑做一次）

### 1. 克隆仓库

**方式 A：SSH（推荐，一次配好永久免密）**

先配置 SSH 密钥（如果这台电脑还没有）：

```bash
ssh-keygen -t ed25519 -C "525962701@qq.com"      # 一路回车
cat ~/.ssh/id_ed25519.pub                          # 复制输出
```

把复制的内容粘到 GitHub → **Settings → SSH and GPG keys → New SSH key**，然后：

```bash
git clone git@github.com:Soft-Fang/Whimsical.git
```

**方式 B：HTTPS + 访问令牌**

```bash
git clone https://github.com/Soft-Fang/Whimsical.git
```
用户名填 `Soft-Fang`，密码填你的 **Personal Access Token**（不是登录密码）。

> 建议仓库放到非 C 盘，例如 `D:\wangtianyu\ForMyself\Whimsical`，和另一台保持一致更好找。

### 2. 设置提交身份（每台电脑各设一次）

```bash
git config user.name  "soft-fang"
git config user.email "525962701@qq.com"
```

### 3. 安装依赖

```bash
cd Whimsical
npm install
```

### 4. 创建私有空间密码文件（重要）

仓库里 **不包含** `.env`（已 gitignore），需要手动创建：

```bash
# 从模板复制
copy .env.example .env      # Windows
# cp .env.example .env      # macOS / Linux
```

然后编辑 `.env`，把密码改成**和另一台电脑完全一致**的值：

```
PRIVATE_PASSWORD=你的强密码
```

> ⚠️ 两台电脑的密码**必须一模一样**，否则私有区解密会失败。

### 5. 启动预览

```bash
npm run dev
```

浏览器打开 **http://localhost:4321/Whimsical/** 即可。

---

## 三、日常写作流程

```bash
git pull                 # ① 先拉最新，避免冲突
npm run dev              # ② 边写边预览（可挂着不关）
# ... 在 content/ 里写文章 ...
npm run check            # ③ 可选：内容体检（frontmatter、死链、泄密风险）
git add -A
git commit -m "feat: 新文章《xxx》"
git push                 # ④ 推送后 GitHub Actions 自动构建并发布
```

推送后约 1~2 分钟，访问 https://soft-fang.github.io/Whimsical/ 即可看到更新。

> 用 Obsidian 的 **Git 插件**可以省掉命令行：`Ctrl+P` → `Git: Commit all changes` / `Git: Push`。

---

## 四、写文章放哪里

| 目录 | 内容 | 是否需要 title |
|---|---|---|
| `content/blog/` | 正文文章 | ✅ 必填 `title` / `description` / `pubDate` |
| `content/talk/` | 随笔（碎碎念） | `title` 可选（不写则用文件名） |
| `content/apps/` | 应用介绍 | ✅ 必填 `name` / `description` |
| `content/drafts/` | 草稿（不发布） | — |
| `content/private/` | 私有明文（**不提交**） | — |
| `content/templates/` | 写作模板 | — |

写作模板可以直接从 `content/templates/` 复制。

---

## 五、⚠️ 哪些东西**不会**跟着 git 同步

这些都在 `.gitignore` 里，**只在本机存在**，换电脑时需要另行处理：

| 路径 | 说明 | 建议 |
|---|---|---|
| `.env` | 私有区密码 | 手动创建（见上） |
| `.obsidian/` | Obsidian 配置 + **已装插件** | **已自动化**：跑 `setup/bootstrap.ps1` 按清单装回来（见第七节） |
| `content/private/` | 私有笔记**明文** | 用 Obsidian Sync / 网盘 / U 盘手动同步 |
| `content/study/` | 学习笔记（仅本地） | 同上 |
| `维护教程.md`、`content/仪表盘.md`、`Excalidraw/` | 本地辅助文件 | 同上 |
| `node_modules/`、`dist/`、`.astro/` | 依赖与构建产物 | 新电脑 `npm install` 即可重建 |

> 会被同步的**私有内容**是加密后的 `src/data/private-posts.json`（密文，已提交）。
> 但它的**源文件** `content/private/*.md` 不会同步——所以想在第二台电脑**继续编辑**私有笔记，需要自己同步 `content/private/` 目录。

---

## 六、常见问题

**Q：`npm : 无法加载文件 ... npm.ps1，因为在此系统上禁止运行脚本`**
PowerShell 执行策略限制。任选其一：
```powershell
# 方案 1：当前用户放开（推荐）
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
# 方案 2：改用 cmd（临时绕过）
cmd /c "npm run dev"
```

**Q：端口 4321 被占用 / 页面打不开**
```bash
npm run dev -- --port 4322
```

**Q：push 后网站没更新**
去 GitHub 仓库 **Actions** 标签页看构建日志；若失败，通常是某篇文章的 frontmatter 写错了（本地先跑 `npm run check` 能提前发现）。

**Q：`npm run encrypt` 报 `content/private 目录里没有 .md 文件`**
脚本原先只扫描 `content/private/` 的**顶层**目录，笔记按主题分到子目录里就一篇都扫不到。
已修复为**递归扫描**，现在 `content/private/数据结构/README.md` 这种嵌套位置也能正常加密。

**Q：私有区打不开**
确认 `.env` 里的 `PRIVATE_PASSWORD` 和最初加密时一致，然后重新 `npm run encrypt` 并提交 `src/data/private-posts.json`。

---

## 七、新电脑自动装 Obsidian 插件

`.obsidian/` 在 `.gitignore` 里被整体忽略，所以**插件不会跟着 git 走** —— 这就是换电脑后插件全没的原因。
这里用「清单 + 脚本」解决，仓库里存两份同一数据源的文件：

| 文件 | 给谁读 | 内容 |
|---|---|---|
| `setup/config/obsidian-plugins.json` | **脚本**读 | id / 仓库 / 版本 / 是否启用 |
| `docs/Obsidian插件清单.md` | **人**读 | 同一份清单的表格版 + 官方页面链接 + 手动安装步骤 |

### 新电脑：跑一条命令

```powershell
powershell -ExecutionPolicy Bypass -File setup\bootstrap.ps1
```

macOS / Linux：

```bash
bash setup/bootstrap.sh
```

脚本会自动装 Git / Node.js / Obsidian，`npm install`，配好 Git 身份，
然后**按清单把插件下载进 `.obsidian/plugins/` 并写进启用列表**。
第一次跑建议先加 `-DryRun` 看看会做什么（不改任何文件）。

### 在已配好的电脑上新增插件后

```bash
npm run setup:export    # 采集当前 vault 的插件状态，并同步重写上面两个文件
git add setup/config/obsidian-plugins.json docs/Obsidian插件清单.md
git commit -m "chore: 更新 Obsidian 插件清单"
git push
```

> 也可以只跑 `npm run setup:docs` 重新生成文档（比如你手工改了清单里的备注）。

### 不想跑脚本

打开 `docs/Obsidian插件清单.md`，照着表格在 Obsidian 的 `设置 → 第三方插件 → 浏览` 里
逐个搜索安装即可，每个插件都给了**官方页面直达链接**用来核对插件 ID。

> ⚠️ 插件的 `data.json`（里面有 Token、绝对路径等）**故意不进仓库**。
> 换电脑后要重新登录一次的主要是 **Git 插件**：填 GitHub 用户名 + Personal Access Token。

---

## 八、一条命令版本（已装好 Git / Node 的前提下）

```bash
git clone git@github.com:Soft-Fang/Whimsical.git && cd Whimsical && npm install && copy .env.example .env && npm run dev
```