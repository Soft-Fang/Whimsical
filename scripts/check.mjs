// 内容体检脚本：校验 frontmatter、引用/连接有效性、孤岛文章、泄密风险
// 用法：npm run check
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const blogDir = join(root, 'content', 'blog');

const ALLOWED_STATUS = ['draft', 'review', 'published', 'private'];

let errors = 0;
let warnings = 0;
const err = (msg) => { errors++; console.error('  ✗ ' + msg); };
const warn = (msg) => { warnings++; console.warn('  ⚠ ' + msg); };

// 极简 frontmatter 解析（支持 key: value、引号字符串、- 列表）
function parseFrontmatter(md) {
  if (!md.startsWith('---')) return { attrs: {}, body: md };
  const end = md.indexOf('\n---', 3);
  if (end === -1) return { attrs: {}, body: md };
  const fm = md.slice(3, end);
  const body = md.slice(end + 4).replace(/^\r?\n/, '');
  const attrs = {};
  let current = null;
  for (const rawLine of fm.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && current && Array.isArray(attrs[current])) {
      attrs[current].push(listMatch[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      const val = kv[2].trim();
      if (val === '' || val === '[]') {
        attrs[key] = [];
      } else {
        attrs[key] = val.replace(/^["']|["']$/g, '');
      }
      current = key;
    }
  }
  return { attrs, body };
}

function getSlug(file) {
  return file.replace(/\.(md|mdx)$/, '');
}

// 1. 读取所有公开文章
const files = readdirSync(blogDir).filter((f) => /\.mdx?$/.test(f)).sort();
const posts = files.map((f) => {
  const raw = readFileSync(join(blogDir, f), 'utf8');
  return { slug: getSlug(f), file: f, attrs: parseFrontmatter(raw).attrs };
});
const slugs = new Set(posts.map((p) => p.slug));

// 2. 逐篇校验
for (const p of posts) {
  const a = p.attrs;
  const ctx = `[${p.file}]`;
  if (!a.title) err(`${ctx} 缺少 title`);
  if (!a.description) err(`${ctx} 缺少 description`);
  if (!a.pubDate) err(`${ctx} 缺少 pubDate`);
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(a.pubDate)) err(`${ctx} pubDate 格式应为 YYYY-MM-DD，当前为 ${a.pubDate}`);
  if (a.status !== undefined && !ALLOWED_STATUS.includes(a.status)) err(`${ctx} status 非法：${a.status}（允许 ${ALLOWED_STATUS.join(' / ')}）`);
  if (a.status && a.status !== 'published') warn(`${ctx} 状态为 ${a.status}，但位于公开区 content/blog/；草稿请放 content/drafts/，私密请放 content/private/`);
  if (!a.category) warn(`${ctx} 未设置 category（专题）`);
  for (const kind of ['references', 'links']) {
    const arr = a[kind];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    for (const ref of arr) {
      if (!slugs.has(ref)) err(`${ctx} ${kind} 指向不存在的文章 slug「${ref}」`);
    }
  }
}

// 3. 孤岛检测（既无出向连接，也无入向连接）
const incoming = new Set();
for (const p of posts) {
  for (const kind of ['references', 'links']) {
    const arr = p.attrs[kind];
    if (Array.isArray(arr)) for (const r of arr) incoming.add(r);
  }
}
for (const p of posts) {
  const out = [
    ...(Array.isArray(p.attrs.references) ? p.attrs.references : []),
    ...(Array.isArray(p.attrs.links) ? p.attrs.links : []),
  ];
  if (out.length === 0 && !incoming.has(p.slug)) {
    warn(`[${p.file}] 是孤岛文章：没有任何引用/连接。建议加 links 或 references 连到旧文章。`);
  }
}

// 4. 泄密风险扫描（针对 git 已跟踪文件）
function secretScan() {
  let tracked;
  try {
    const gitRoot = root.replace(/\\/g, '/');
    tracked = execFileSync('git', ['-c', `safe.directory=${gitRoot}`, 'ls-files'], { cwd: root, encoding: 'utf8' });
  } catch (e) {
    warn('无法执行 git ls-files，跳过泄密扫描（请确认在 git 仓库内运行）');
    return;
  }
  const paths = tracked.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const rel of paths) {
    if (rel === '.env' || rel.endsWith('.env') || rel.startsWith('content/private/')) {
      err(`泄密风险：${rel} 已被 git 跟踪。请执行 git rm --cached "${rel}" 并确保 .gitignore 已忽略它`);
    }
  }
  for (const rel of paths) {
    if (!/\.md$/.test(rel)) continue;
    if (!/^content\//.test(rel)) continue;
    const content = readFileSync(join(root, rel), 'utf8');
    if (content.includes('PRIVATE_PASSWORD')) {
      warn(`${rel} 中出现 PRIVATE_PASSWORD 字样，请确认未泄露真实密码`);
    }
  }
}

console.log('内容体检中……\n');
secretScan();

console.log(`\n检查完成：${errors} 个错误，${warnings} 个警告`);
if (errors > 0) {
  console.error('❌ 存在错误，请修复后再提交。');
  process.exit(1);
}
if (warnings > 0) console.warn('⚠ 存在警告，建议处理后再提交。');
else console.log('✅ 内容健康检查通过');