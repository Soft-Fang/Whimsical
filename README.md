# 我的博客（Whimsical）

基于 Astro 7 + Tailwind CSS 4 的个人博客，免费托管在 GitHub Pages。
主题来自 [good-looking-basics-blog](https://astro.build/themes/details/good-looking-basics-blog/)。

- 在线地址：https://soft-fang.github.io/Whimsical/
- 仓库地址：https://github.com/Soft-Fang/Whimsical

## 功能

- 博客文章（`src/content/blog/`）
- 归档（时间轴 + 搜索 + 标签）
- 应用展示（`src/pages/apps.astro`，内容在 `src/content/apps/`）
- 私有空间（密码解锁，内容加密，`src/pages/private.astro`）
- 今日说法、照片相册、明暗主题、壁纸系统

## 本地运行

需要 Node.js >= 22.12。

    npm install
    npm run dev

浏览器打开 http://localhost:4321/Whimsical/ 预览。

## 常用配置

几乎都在一个文件里：`src/site.config.ts`（网站名、简介、作者、导航栏）。

## 目录结构

- `src/site.config.ts` —— 全局站点配置（⭐ 改这个）
- `src/content/blog/` —— 博客文章（.md）
- `src/content/apps/` —— 应用介绍（.md）
- `src/content/talk/` —— 今日说法（.md）
- `src/assets/wallpaper/light|dark/` —— 主题壁纸
- `src/assets/album/` —— 照片相册
- `src/pages/` —— 页面路由
- `public/` —— 静态资源（favicon、og.png）

## 私有空间

- 明文放 `private-notes/`（已 gitignore，不提交）
- 加密：`npm run encrypt`（密码来自 `PRIVATE_PASSWORD` 环境变量或 `.env`）
- 生成 `src/data/private-posts.json`（密文，可提交）

## 部署到 GitHub Pages

推送 `main` 后由 `.github/workflows/deploy.yml` 自动构建部署（Settings → Pages → Source 选 GitHub Actions）。
