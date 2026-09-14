// 内容集合的公共查询与工具
// 所有页面 / RSS 一律通过这里取文章，保证「只发布 published」这条规则只有一处实现
import { getCollection } from 'astro:content';

/**
 * 只取「已发布」的正文文章。
 * content/blog/ 里若混入了 status: draft / review / private 的文件，
 * 一律不会出现在首页、归档、专题、/posts、RSS 及详情页。
 */
export async function getPublishedPosts() {
  return (await getCollection('blog')).filter((p) => (p.data.status ?? 'published') === 'published');
}

/**
 * 解析 frontmatter 的 cover 字段：
 * - 外部链接（http/https）原样返回
 * - 相对路径自动补上站点 base 前缀（如 'covers/a.webp' → '/Whimsical/covers/a.webp'）
 * - 未填返回 null，调用方自行回退到默认配图逻辑
 */
export function coverURL(base: string, cover?: string | null): string | null {
  if (!cover) return null;
  if (/^https?:\/\//i.test(cover)) return cover;
  return base + String(cover).replace(/^\/+/, '');
}
