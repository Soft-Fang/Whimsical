import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// 容错：Obsidian 的 tags/links/references 可能写成单个字符串，这里统一转成数组
const stringList = z
  .union([z.array(z.string()), z.string()])
  .transform((v) => (Array.isArray(v) ? v : [v]));

const blog = defineCollection({
  loader: glob({ base: './content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.string(),
    // 内容生命周期：draft(草稿) / review(待确认) / published(公开) / private(私密)
    // 注意：公开内容区 content/blog/ 只放 published；草稿放 content/drafts/，私密放 content/private/
    status: z.enum(['draft', 'review', 'published', 'private']).default('published'),
    // references = 引用（星空归档图据此画实线/虚线）
    references: stringList.optional(),
    // links = 相关连接（非引用，供知识图谱 / 推荐使用）
    links: stringList.optional(),
    category: z.string().optional(),
    tags: stringList.optional(),
  }),
});

const talk = defineCollection({
  loader: glob({ base: './content/talk', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    update: z.string().optional(),
    description: z.string().optional(),
  }),
});

const apps = defineCollection({
  loader: glob({ base: './content/apps', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    name: z.string(),
    url: z.string().optional(),
    repo: z.string().optional(),
    description: z.string(),
    tags: stringList.optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { blog, talk, apps };