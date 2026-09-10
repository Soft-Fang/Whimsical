# AGENTS.md — 本仓库协作约定（任何机器上的 AI / 维护者请先读这里）

## 项目是什么
- 个人博客，技术栈 Astro 7 + Tailwind CSS 4，托管于 GitHub Pages。
- 线上地址：https://soft-fang.github.io/Whimsical/
- 本地约定路径：D:\wangtianyu\ForMyself\Whimsical
- `base` 为 `/Whimsical/`，**不要改** `astro.config.mjs` 里的 base，也不要改 `src/site.config.ts` 的 url 结构。
- 开始任何改动前，先阅读 `维护教程.md`（含各文件夹「定性」，是本仓库的使用宪法）。

## 目录结构
- `content/`           所有 Markdown 内容的根目录，也是 Obsidian vault（在 Obsidian 里打开这个文件夹）
- `content/blog/`      公开文章（只放 published）
- `content/apps/`      应用介绍（应用专题）
- `content/talk/`      短句 / 碎碎念
- `content/drafts/`    草稿（不渲染、可提交同步；敏感草稿放 content/private）
- `content/private/`   私有明文（**gitignore，永不提交**），加密后生成 `src/data/private-posts.json`
- `content/templates/` 写作模板（每个内容文件夹一个，新建文件自动套用）：博客文章 / 碎碎念 / 应用 / 草稿 / 私人 / 学习
- `scripts/`           工具：encrypt.mjs（私有区加密）、check.mjs（内容体检）
- `维护教程.md`        本地维护说明（**gitignore，不上传**）——**每次改动前先读它**，含各文件夹定性

## 内容规范（frontmatter）
blog 文章必填：`title`、`description`、`pubDate`（YYYY-MM-DD）。
- `category`：固定标签，按文件夹锁死（blog=正文、talk=随笔、apps=应用）；专题归属由「放在哪个文件夹」决定，勿手改
- `tags`：数组（或单个字符串，schema 会自动转数组）
- `status`：draft / review / published / private，默认 published
  - **公开区 `content/blog/` 只放 published**；草稿放 `content/drafts/`，私密放 `content/private/`
- `references`：引用（星空归档图据此画实线 / 虚线）
- `links`：相关连接（非引用，供知识图谱 / 推荐使用）

## 写作流程（个人数据库原则）
1. 草稿写 `content/drafts/`，状态 `draft`
2. 定稿移入 `content/blog/`，状态改 `published`
3. 每篇尽量用 `links` / `references` 连到至少一篇旧文章（连接是复利）
4. 私有 / 敏感内容写 `content/private/`，用 `npm run encrypt` 加密后再提交

## 与 Obsidian 的配合
- 在 Obsidian 中把 `content/` 作为 vault 打开
- `.obsidian/` 已 gitignore；建议装 Obsidian Git 插件自动提交 / 拉取
- 公开文章不要用 `[[wikilink]]` / `> [!note]` / `![[嵌入]]` 等 Obsidian 专属语法（Astro 不渲染），连接用 frontmatter 的 `links` / `references` 或标准 Markdown 链接

## 提交前必做
- 跑 `npm run check`，0 错误才提交
- 私有区有变更时先 `npm run encrypt`
- **提交前、提交后都要提醒用户**
- commit message 用 `feat:` / `refactor:` / `fix:` 等前缀，写清改了什么

## 敏感信息红线
- `PRIVATE_PASSWORD` / 真实密码 / `content/private/` 明文 / `.env` **永不进入仓库**
- 密码只存在于本地 `.env` 或环境变量，聊天记录也不要出现

## 多端同步
新电脑三步：`git clone` → `npm install` → `npm run dev`
私有明文 `content/private/` 需另外手动迁移（可用备份脚本）。

## 常用命令
- `npm run dev`      本地预览 http://localhost:4321/Whimsical/
- `npm run check`    内容体检（校验 / 断链 / 孤岛 / 泄密）
- `npm run encrypt`  加密私有区（需先设 PRIVATE_PASSWORD）
- `npm run build`    构建