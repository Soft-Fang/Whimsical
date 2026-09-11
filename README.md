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

> **换一台新电脑？** 不用手工做上面这些。
> 执行 `powershell -ExecutionPolicy Bypass -File setup\bootstrap.ps1`，
> 会自动装依赖、配 Git 身份、并把 Obsidian 插件按清单装回来。
> 详见 **[SETUP.md](SETUP.md)**。

## 目录结构

- `content/` —— 所有 Markdown 内容（Obsidian vault 就在仓库根目录）
  - `content/blog/` —— 博客文章
  - `content/apps/` —— 应用介绍
  - `content/talk/` —— 随笔
  - `content/drafts/` —— 草稿（不发布）
  - `content/private/` —— 私有明文（gitignore，加密后才提交）
  - `content/templates/` —— 写作模板
- `setup/` —— 跨设备一键配置工具（见 [SETUP.md](SETUP.md)）
- `docs/Obsidian插件清单.md` —— 插件表（自动生成，可照着手动装）
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

**把仓库根目录作为 vault 打开**（不是 `content/`）—— 因为 `.obsidian/` 在仓库根目录，
插件清单也是按这个结构还原的。

公开文章使用标准 Markdown 链接和 frontmatter 的 `links` / `references`，
避免使用 `[[wikilink]]` 等 Obsidian 专属语法。

> `.obsidian/` 被 gitignore 忽略，所以插件不跟着仓库走。
> 换电脑时由 `setup/` 按清单自动装回来，装完新增插件记得跑 `npm run setup:export`。

## 部署到 GitHub Pages

推送 `main` 后由 `.github/workflows/deploy.yml` 自动构建部署
（Settings → Pages → Source 选 GitHub Actions）。