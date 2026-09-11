// ── 全局站点配置 ──
// 只改这个文件，整个站点自动更新

export const site = {
  // 网站名称（导航栏 logo、页脚、页面标题后缀、SEO）
  name: 'Whimsical',

  // 默认页面标题（未指定 title 时的后备值）
  defaultTitle: 'Whimsical',

  // SEO 站点描述（meta description）
  description: '个人心绪分享',

  // ── SEO：分享与链接 ──
  url: 'https://soft-fang.github.io/',   // 站点域名（必须带 https://）
  ogImage: '/og.png',                    // 社交分享预览图（public/og.png，建议 1200×630）
  ogSiteName: 'Whimsical',               // 分享卡片上显示的站点名

  // 作者信息
  author: {
    name: 'Soft-Fang',
    github: 'Soft-Fang',
    location: '',
  },

  // 关于页面的介绍文字
  about: '记录突如其来的奇怪想法',

  // 导航栏（href + 显示文字，数组顺序即显示顺序）
  nav: [
    { href: '/posts', label: '文章' },
    { href: '/topics', label: '专题' },
    { href: '/archive', label: '归档' },
    { href: '/about', label: '关于我' },
  ],
};