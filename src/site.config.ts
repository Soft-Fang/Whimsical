// ── 全局站点配置 ──
// fork 后只需改这个文件，整个站点自动更新

export const site = {
  // 网站名称（导航栏 logo、页脚、页面标题后缀、SEO）
  name: '我的博客',

  // 默认页面标题（未指定 title 时的后备值）
  defaultTitle: '我的博客',

  // SEO 站点描述（meta description）
  description: '写代码、记录学习、分享应用。',

  // ── SEO：分享与链接 ──
  url: 'https://soft-fang.github.io/',   // 站点域名（必须带 https://）
  ogImage: '/og.png',                    // 社交分享预览图（public/og.png，建议 1200×630）
  ogSiteName: '我的博客',                // 分享卡片上显示的站点名

  // 作者信息
  author: {
    name: 'Soft Fang',
    github: 'Soft-Fang',
    location: 'Shanghai',
  },

  // 关于页面的介绍文字
  about: '这是我的个人博客，用 Astro 构建。记录学习笔记、技术文章，以及做过的应用。',

  // 导航栏（href + 显示文字，数组顺序即显示顺序）
  nav: [
    { href: '/blog', label: '文章' },
    { href: '/archive', label: '归档' },
    { href: '/apps', label: '应用' },
    { href: '/private', label: '私有' },
    { href: '/about', label: '关于我' },
  ],
};
