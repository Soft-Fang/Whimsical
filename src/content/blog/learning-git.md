---
title: "用 Git 实现多端同步"
date: "2026-08-23"
description: "换一台电脑也能快速继续维护博客的方法。"
tags:
  - Git
  - 教程
---

把整个博客项目托管到 GitHub 后，在任何电脑上都能快速恢复环境。

## 在新电脑上的三步

1. 安装 Node.js 和 Git。
2. 克隆仓库：

        git clone https://github.com/你的用户名/仓库名.git

3. 安装依赖并启动：

        npm install
        npm run dev

## 日常维护

写完文章后提交并推送：

    git add .
    git commit -m "新增一篇文章"
    git push

GitHub Actions 会自动构建并部署到 GitHub Pages。
