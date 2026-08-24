# Whimsical

基于 [Astro](https://astro.build) 的个人博客，免费托管在 GitHub Pages。

- 在线地址：https://soft-fang.github.io/Whimsical/
- 仓库地址：https://github.com/Soft-Fang/Whimsical

## 功能

- **文章**（学习笔记 / 技术文章）：放在 `src/content/blog/`
- **应用介绍**：放在 `src/content/apps/`
- 首页自动展示最新文章和精选应用

## 本地运行

需要 Node.js 18+（推荐 20 或 22）。

    npm install
    npm run dev

浏览器打开 http://localhost:4321 预览。

## 目录结构

- `src/pages/` —— 页面路由
- `src/layouts/` —— 布局模板
- `src/content/blog/` —— 博客文章（Markdown）
- `src/content/apps/` —— 应用介绍（Markdown）
- `src/styles/global.css` —— 全局样式
- `public/` —— 静态资源（图标等）

## 写文章

在 `src/content/blog/` 新建 `文章标题.md`：

    ---
    title: "文章标题"
    date: "2026-08-24"
    description: "一句话简介"
    tags:
      - 标签1
    ---

    正文 Markdown...

## 添加应用

在 `src/content/apps/` 新建 `应用名.md`：

    ---
    name: "应用名"
    url: "https://..."
    repo: "https://github.com/..."
    description: "一句话介绍"
    tags:
      - 标签
    featured: true
    ---

    详细介绍...

## 部署到 GitHub Pages

1. 本仓库：https://github.com/Soft-Fang/Whimsical
2. `astro.config.mjs` 已配置：
   - `site: https://soft-fang.github.io`
   - `base: /Whimsical/`
3. 推送到 `main` 分支后，GitHub Actions 会自动构建部署（`.github/workflows/deploy.yml`）。
4. 首次使用需在仓库 Settings → Pages 里把 Source 选为 **GitHub Actions**。

## 多端同步

- 项目全部用 Git 管理。
- 换电脑后：安装 Node.js + Git，然后执行：

      git clone git@github.com:Soft-Fang/Whimsical.git
      npm install
      npm run dev

- 日常写完内容：`git add . && git commit -m "说明" && git push`。
