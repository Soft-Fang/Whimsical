// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { site } from './src/site.config';

// https://astro.build/config
export default defineConfig({
  // 站点域名统一从 site.config.ts 读取（url 留空时用占位域名）
  site: site.url || 'https://example.com',
  // GitHub Pages 项目站点：Soft-Fang/Whimsical
  base: '/Whimsical/',
  server: {
    host: true
  },
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});
