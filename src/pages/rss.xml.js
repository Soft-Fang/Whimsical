// RSS 订阅源：构建时生成 /rss.xml，读者可用 RSS 阅读器订阅

import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site } from '../site.config';

export async function GET(context) {
  const posts = await getCollection('blog');
  return rss({
    title: site.defaultTitle,
    description: site.description,
    site: context.site,
    items: posts
      // 过滤掉 pubDate 无效的文章（如 '2025-05-425'），否则 RSS 生成会报错
      .filter((post) => !Number.isNaN(new Date(post.data.pubDate).getTime()))
      .map((post) => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: new Date(post.data.pubDate),
        link: `/blog/${post.id}/`,
      })),
    customData: '<language>zh-cn</language>',
  });
}
