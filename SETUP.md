# 跨设备写作指南

> 新电脑 5 分钟配好；之后写完 `push` 就自动发布。

**在线地址**：https://soft-fang.github.io/Whimsical/
**仓库地址**：https://github.com/Soft-Fang/Whimsical

---

## 一、新电脑配置

### 1. 装两个软件

| 软件 | 版本 | 说明 |
|---|---|---|
| Git | 任意较新版 | 装完 `git --version` 有输出即可 |
| Node.js | **≥ 22.12** | [官网](https://nodejs.org)选 LTS，**勾选 Add to PATH** |

Obsidian 不用提前装，第 3 步的脚本会顺带装上。

### 2. 配 SSH 密钥（推荐，配一次永久免密）

```bash
ssh-keygen -t ed25519 -C "525962701@qq.com"    # 一路回车
cat ~/.ssh/id_ed25519.pub                       # 复制全部输出
```

粘贴到 GitHub → **Settings → SSH and GPG keys → New SSH key**。

> 不想用 SSH：克隆时换成 `https://github.com/Soft-Fang/Whimsical.git`，
> 推送时用户名填 `Soft-Fang`，密码填 Personal Access Token。

### 3. 克隆 + 一键配置

```powershell
git clone git@github.com:Soft-Fang/Whimsical.git
cd Whimsical
powershell -ExecutionPolicy Bypass -File setup\bootstrap.ps1
```

macOS / Linux 把最后一行换成 `bash setup/bootstrap.sh`。

脚本会按顺序做完这些：

| 步骤 | 内容 |
|---|---|
| 检查环境 | 缺 Git / Node.js / Obsidian 就用 winget（或 brew）装 |
| 同步仓库 | 配好 origin，`git pull --ff-only` |
| 安装依赖 | `npm ci` |
| 配置身份 | `git config user.name` / `user.email` |
| **还原 Obsidian 插件** | 按清单下载并启用（见第五节） |
| 更新 .gitignore | 补 `setup/.cache/` |

想先看它要做什么，加 `-DryRun`（不改任何文件）。
仓库建议放在 `D:\wangtianyu\ForMyself\Whimsical`，和另一台电脑保持一致；换位置用 `-Dir "D:\你的路径"`。

### 4. 手动收尾（只有 3 件）

**① 用 Obsidian 打开 vault**

Obsidian → `Open folder as vault` → 选中**仓库根目录**（不是 `content/`）。插件此时已经装好了。

**② 登录 Git 插件**

Obsidian 设置 → **Git** → 填 GitHub 用户名 `Soft-Fang` + Personal Access Token。

> 插件的 `data.json` 里存着 Token，故意不进仓库，所以每台新电脑都要登录一次。

**③ 建私有空间密码文件**

```powershell
Copy-Item .env.example .env      # macOS / Linux: cp .env.example .env
notepad .env                     # 填 PRIVATE_PASSWORD=你的密码
```

> ⚠️ 所有电脑的 `PRIVATE_PASSWORD` 必须**完全一致**，否则私有区解不开。

### 5. 验证

```bash
npm run dev
```

打开 http://localhost:4321/Whimsical/ 能看到博客就成功了。

---

## 二、日常写作

```bash
git pull                 # ① 先拉最新，避免冲突
npm run dev              # ② 挂着预览（可选）
# ... 在 content/ 里写文章 ...
npm run check            # ③ 内容体检：frontmatter、死链、泄密风险（可选）
git add -A && git commit -m "feat: 新文章《xxx》" && git push
```

推送后 1~2 分钟自动发布。构建失败就去仓库的 **Actions** 标签看日志。

> 用 Obsidian 的 Git 插件可以全程不开命令行：
> `Ctrl+P` → `Git: Commit all changes` → `Git: Push`。

---

## 三、内容放哪里

| 目录 | 内容 | frontmatter |
|---|---|---|
| `content/blog/` | 正文文章 | `title` / `description` / `pubDate` 必填 |
| `content/talk/` | 随笔 | `title` 可选，不写则用文件名 |
| `content/apps/` | 应用介绍 | `name` / `description` 必填 |
| `content/drafts/` | 草稿（不发布） | 随便写 |
| `content/private/` | 私有明文（**不提交**） | 加密后发布 |
| `content/templates/` | 写作模板 | 直接复制改 |

---

## 四、哪些东西不会跟着仓库走

| 路径 | 内容 | 新电脑怎么办 |
|---|---|---|
| `.obsidian/` | Obsidian 插件 | ✅ 脚本自动还原 |
| `.env` | 私有区密码 | 手动创建（见 一.4③） |
| 插件 `data.json` | Git 插件的 Token 等 | 手动重新登录（见 一.4②） |
| `content/private/` | 私有笔记**明文** | 网盘 / U 盘自己同步 |
| `content/study/` | 学习笔记 | 同上 |
| `维护教程.md`、`Excalidraw/`、`content/仪表盘.md` | 本地辅助文件 | 同上 |
| `node_modules/`、`dist/`、`.astro/` | 依赖与构建产物 | 脚本自动重建 |

> 私有内容**发布用的密文** `src/data/private-posts.json` 是提交的；
> 但**源文件** `content/private/` 不提交 —— 想在别的电脑继续编辑私有笔记，得自己同步这个目录。

---

## 五、插件清单怎么维护

仓库里有两份同一数据源的文件：

| 文件 | 用途 |
|---|---|
| `setup/config/obsidian-plugins.json` | 脚本读，换电脑照此还原 |
| `docs/Obsidian插件清单.md` | 人读，表格 + 官方页面链接 + 手动安装步骤 |

**装了新插件之后**，在装插件的那台电脑上执行：

```bash
npm run setup:export    # 采集当前 vault 的插件状态，两份文件一起更新
git add setup/config/obsidian-plugins.json docs/Obsidian插件清单.md
git commit -m "chore: 更新 Obsidian 插件清单"
git push
```

**不想跑脚本**：打开 `docs/Obsidian插件清单.md`，照着表格在
Obsidian `设置 → 第三方插件 → 浏览` 里逐个搜索安装，效果一样。

---

## 六、常见问题

**Q：`npm` 报「在此系统上禁止运行脚本」**

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**Q：端口 4321 被占用**

```bash
npm run dev -- --port 4322
```

**Q：push 后网站没更新**

去仓库的 **Actions** 标签看构建日志。多半是某篇文章 frontmatter 写错，本地先跑 `npm run check` 能提前发现。

**Q：私有区打不开**

`.env` 里的 `PRIVATE_PASSWORD` 必须和加密时一致。改了密码就重新 `npm run encrypt`，并提交 `src/data/private-posts.json`。

**Q：插件装了但 Obsidian 里看不到**

确认 Obsidian 已关闭「受限模式」（设置 → 第三方插件），然后完全退出重开。

---

## 七、脚本跑不通时的手动步骤

```bash
# 1. 克隆
git clone git@github.com:Soft-Fang/Whimsical.git && cd Whimsical

# 2. 提交身份
git config user.name  "soft-fang"
git config user.email "525962701@qq.com"

# 3. 依赖
npm install

# 4. 私有密码
cp .env.example .env       # 然后编辑，填入密码

# 5. 插件
#    打开 docs/Obsidian插件清单.md，照着表格在
#    Obsidian → 设置 → 第三方插件 → 浏览 里逐个安装

# 6. 预览
npm run dev
```