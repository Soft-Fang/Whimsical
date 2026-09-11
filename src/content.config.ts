import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// 容错：Obsidian/QuickAdd 可能写成单个字符串、空值(null)，或未加引号的日期
const stringList = z.preprocess(
  (v) => (v == null ? [] : v),
  z.union([z.array(z.string()), z.string()]).transform((v) => (Array.isArray(v) ? v : [v]))
);

// pubDate 允许字符串或 YAML 日期对象（未加引号的 2026-09-08 会被解析成 Date），统一转成 YYYY-MM-DD 字符串
const dateString = z.preprocess(
  (v) => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return v;
  },
  z.string()
);

const blog = defineCollection({
  loader: glob({ base: './content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: dateString,
    // 内容生命周期：draft(草稿) / review(待确认) / published(公开) / private(私密)
    // 注意：公开内容区 content/blog/ 只放 published；草稿放 content/drafts/，私密放 content/private/
    status: z.enum(['draft', 'review', 'published', 'private']).default('published'),
    // references = 引用（星空归档图据此画实线/虚线）
    references: stringList.optional(),
    // links = 相关连接（非引用，供知识图谱 / 推荐使用）
    links: stringList.optional(),
    // 专题标签：按文件夹自动确定（content/blog/ = 正文），模板已锁死，勿手改
    category: z.string().optional(),
    tags: stringList.optional(),
  }),
});

const talk = defineCollection({
  loader: glob({ base: './content/talk', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string().optional(),
    update: z.string().optional(),
    description: z.string().optional(),
    // 专题标签：按文件夹自动确定（content/talk/ = 随笔），模板已锁死，勿手改
    category: z.string().optional(),
  }),
});

const apps = defineCollection({
  loader: glob({ base: './content/apps', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    name: z.string(),
    url: z.string().optional(),
    repo: z.string().optional(),
    description: z.string(),
    // 专题标签：按文件夹自动确定（content/apps/ = 应用），模板已锁死，勿手改
    category: z.string().optional(),
    tags: stringList.optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { blog, talk, apps };
