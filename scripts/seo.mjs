// SEO 与内容质量检查：输出文本或 JSON
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const JSON_MODE = process.argv.includes('--json');
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), ok: true, errors: 0, warnings: 0, stats: {}, items: [] };
let errors = 0;
let warnings = 0;

const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);
if (JSON_MODE) {
  console.log = () => {};
  console.error = () => {};
}

function record(severity, message, details = {}) {
  if (severity === 'error') errors++;
  if (severity === 'warning') warnings++;
  report.items.push({ severity, code: details.code || 'SEO', message, ...details });
  if (!JSON_MODE) {
    const prefix = severity === 'error' ? '  ✗ ' : severity === 'warning' ? '  ⚠ ' : '  ℹ ';
    (severity === 'error' ? originalError : originalLog)(prefix + message);
  }
}

const err = (message, details = {}) => record('error', message, details);
const warn = (message, details = {}) => record('warning', message, details);
const info = (message, details = {}) => record('info', message, details);

function parseFrontmatter(md) {
  if (!md.startsWith('---')) return { attrs: {}, body: md, lines: {}, bodyStartLine: 1 };
  const end = md.indexOf('\n---', 3);
  if (end === -1) return { attrs: {}, body: md, lines: {}, bodyStartLine: 1 };
  const fm = md.slice(3, end);
  const body = md.slice(end + 4).replace(/^\r?\n/, '');
  const attrs = {};
  const lines = {};
  let current = null;
  for (const [lineIndex, rawLine] of fm.split(/\r?\n/).entries()) {
    const line = rawLine.replace(/\s+$/, '');
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && current && Array.isArray(attrs[current])) {
      attrs[current].push(listMatch[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    lines[key] = lineIndex + 2;
    let value = kv[2].trim();
    if (value === '') {
      attrs[key] = [];
      current = key;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      attrs[key] = value.slice(1, -1).split(',').map((item) => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      current = key;
    } else {
      attrs[key] = value.replace(/^["']|["']$/g, '');
      current = key;
    }
  }
  return { attrs, body, lines, bodyStartLine: fm.split(/\r?\n/).length + 3 };
}

function details(item, code, field, extra = {}) {
  return { code, file: item.rel, ...(field ? { field, line: item.lines[field] } : {}), ...extra };
}

function textLength(value) {
  return [...String(value || '').trim()].length;
}

const sitePath = join(root, 'src', 'site.config.ts');
const siteText = existsSync(sitePath) ? readFileSync(sitePath, 'utf8') : '';
const siteUrl = (siteText.match(/url:\s*['"]([^'"]+)['"]/) || [])[1] || '';
const ogImage = (siteText.match(/ogImage:\s*['"]([^'"]+)['"]/) || [])[1] || '';
const layoutPath = join(root, 'src', 'layouts', 'BaseLayout.astro');
const layoutText = existsSync(layoutPath) ? readFileSync(layoutPath, 'utf8') : '';

if (!siteUrl || siteUrl.includes('example.com')) {
  err('站点 URL 未配置或仍是占位地址', { code: 'INVALID_SITE_URL', file: 'src/site.config.ts', field: 'url' });
}
if (!ogImage || !existsSync(join(root, 'public', ogImage.replace(/^\/+/, '')))) {
  err(`OG 分享图不存在：${ogImage || '(empty)'}`, { code: 'MISSING_OG_IMAGE', file: `public/${ogImage.replace(/^\/+/, '')}` });
}
if (!layoutText.includes('rel="canonical"')) {
  err('BaseLayout 未输出 canonical 链接', { code: 'MISSING_CANONICAL', file: 'src/layouts/BaseLayout.astro' });
}

const dir = join(root, 'content', 'blog');
const posts = existsSync(dir)
  ? readdirSync(dir).filter((name) => /\.mdx?$/.test(name)).sort().map((name) => {
      const rel = `content/blog/${name}`;
      const raw = readFileSync(join(root, rel), 'utf8');
      const parsed = parseFrontmatter(raw);
      return { rel, slug: name.replace(/\.(md|mdx)$/, ''), raw, ...parsed };
    })
  : [];

const tagCount = new Map();
for (const post of posts) {
  const attrs = post.attrs;
  const title = String(attrs.title || '').trim();
  const description = String(attrs.description || '').trim();
  if (!title) err(`[${post.rel}] 缺少 title`, details(post, 'MISSING_TITLE', 'title'));
  else {
    const length = textLength(title);
    if (length < 6) warn(`[${post.rel}] 标题偏短（${length} 字）`, details(post, 'TITLE_TOO_SHORT', 'title', { length }));
    if (length > 40) warn(`[${post.rel}] 标题偏长（${length} 字）`, details(post, 'TITLE_TOO_LONG', 'title', { length }));
  }
  if (!description) err(`[${post.rel}] 缺少 description`, details(post, 'MISSING_DESCRIPTION', 'description'));
  else {
    const length = textLength(description);
    if (length < 20) warn(`[${post.rel}] 简介偏短（${length} 字）`, details(post, 'DESCRIPTION_TOO_SHORT', 'description', { length }));
    if (length > 160) warn(`[${post.rel}] 简介偏长（${length} 字）`, details(post, 'DESCRIPTION_TOO_LONG', 'description', { length }));
  }
  if (!attrs.pubDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(attrs.pubDate))) {
    err(`[${post.rel}] pubDate 缺失或格式错误`, details(post, 'INVALID_PUBDATE', 'pubDate'));
  }
  if (attrs.updated && !/^\d{4}-\d{2}-\d{2}$/.test(String(attrs.updated))) {
    err(`[${post.rel}] updated 格式错误`, details(post, 'INVALID_UPDATED', 'updated'));
  } else if (attrs.updated && attrs.pubDate && String(attrs.updated) < String(attrs.pubDate)) {
    warn(`[${post.rel}] updated 早于 pubDate`, details(post, 'UPDATED_BEFORE_PUBDATE', 'updated'));
  }
  if (attrs.cover && !/^https?:\/\//i.test(String(attrs.cover))) {
    const coverPath = join(root, 'public', String(attrs.cover).replace(/^\/+/, ''));
    if (!existsSync(coverPath)) warn(`[${post.rel}] cover 文件不存在：${attrs.cover}`, details(post, 'COVER_NOT_FOUND', 'cover', { value: attrs.cover }));
  }
  const tags = Array.isArray(attrs.tags) ? attrs.tags : attrs.tags ? [attrs.tags] : [];
  if (new Set(tags).size !== tags.length) warn(`[${post.rel}] 标签存在重复`, details(post, 'DUPLICATE_TAGS', 'tags'));
  if (tags.length > 6) warn(`[${post.rel}] 标签数量偏多（${tags.length} 个）`, details(post, 'TOO_MANY_TAGS', 'tags', { count: tags.length }));
  for (const tag of tags) tagCount.set(tag, (tagCount.get(tag) || 0) + 1);

  const plainBody = post.body.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/[#>*`_~\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (textLength(plainBody) < 200) warn(`[${post.rel}] 正文偏短（${textLength(plainBody)} 字）`, details(post, 'BODY_TOO_SHORT', 'body'));
  if (!/^##\s+/m.test(post.body)) warn(`[${post.rel}] 正文没有二级标题`, details(post, 'MISSING_H2', 'body'));

  const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let imageMatch;
  while ((imageMatch = IMG_RE.exec(post.body))) {
    if (!imageMatch[1].trim()) {
      const line = post.bodyStartLine + post.body.slice(0, imageMatch.index).split(/\r?\n/).length - 1;
      warn(`[${post.rel}] 图片缺少 alt 文本`, details(post, 'MISSING_IMAGE_ALT', '', { line, src: imageMatch[2] }));
    }
  }

  const slugLength = textLength(post.slug);
  if (slugLength > 60) warn(`[${post.rel}] 文件名偏长（${slugLength} 字）`, details(post, 'SLUG_TOO_LONG', '', { length: slugLength }));
  if (/\s/.test(post.slug)) warn(`[${post.rel}] 文件名包含空格`, details(post, 'SLUG_CONTAINS_SPACE', ''));
}

report.stats.posts = posts.length;
report.stats.tags = tagCount.size;
report.errors = errors;
report.warnings = warnings;
report.ok = errors === 0;

if (JSON_MODE) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(errors > 0 ? 1 : 0);
}

console.log(`\nSEO 检查完成：${errors} 个错误，${warnings} 个警告`);
if (errors > 0) process.exit(1);
