# Whimsical

基于 Astro 7 + Tailwind CSS 4 的个人博客，免费托管在 GitHub Pages。
主题来自 [good-looking-basics-blog](https://astro.build/themes/details/good-looking-basics-blog/)。

- 在线地址：https://soft-fang.github.io/Whimsical/
- 仓库地址：https://github.com/Soft-Fang/Whimsical

## 功能

- 博客文章（`content/blog/`）
- 归档（星空图 + 年月树）
- 专题（正文 / 随笔 / 应用）
- 私有空间（密码解锁，内容加密）
- 随笔、照片相册、明暗主题、壁纸系统

## 本地运行

需要 Node.js >= 22.12。

    npm install
    npm run dev

浏览器打开 http://localhost:4321/Whimsical/ 预览。

## 常用配置

几乎都在一个文件里：`src/site.config.ts`（网站名、简介、作者、导航栏）。

## 目录结构

- `content/` —— 所有 Markdown 内容（也是 Obsidian vault）
  - `content/blog/` —— 博客文章
  - `content/apps/` —— 应用介绍
  - `content/talk/` —— 随笔
  - `content/drafts/` —— 草稿
  - `content/private/` —— 私有明文（gitignore）
  - `content/templates/` —— 写作模板
- `src/content.config.ts` —— 内容集合 schema
- `src/site.config.ts` —— 全局站点配置（⭐ 改这个）
- `src/assets/wallpaper/light|dark/` —— 主题壁纸
- `src/assets/album/` —— 照片相册
- `src/pages/` —— 页面路由
- `public/` —— 静态资源（favicon、og.png）

## 私有空间

- 明文放 `content/private/`（已 gitignore，不提交）
- 加密：`npm run encrypt`（密码来自 `PRIVATE_PASSWORD` 环境变量或 `.env`）
- 生成 `src/data/private-posts.json`（密文，可提交）

## 用 Obsidian 管理内容

在 Obsidian 中把 `content/` 文件夹作为 vault 打开即可。公开文章使用标准 Markdown 链接和 frontmatter 的 `links` / `references`，避免使用 `[[wikilink]]` 等 Obsidian 专属语法。

## 部署到 GitHub Pages

推送 `main` 后由 `.github/workflows/deploy.yml` 自动构建部署（Settings → Pages → Source 选 GitHub Actions）。