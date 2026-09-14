// 内容体检脚本：校验 frontmatter、图片、引用/连接、孤岛文章、标签规范、泄密风险
// 用法：npm run check
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const JSON_MODE = process.argv.includes('--json');

const ALLOWED_STATUS = ['draft', 'review', 'published', 'private'];
const BASE = '/Whimsical';

let errors = 0;
let warnings = 0;
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  ok: true,
  errors: 0,
  warnings: 0,
  stats: {},
  items: [],
};

const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);
if (JSON_MODE) {
  console.log = () => {};
  console.error = () => {};
}

function inferFile(message) {
  const match = message.match(/^\[(.*?)\]/);
  return match ? match[1] : undefined;
}

const record = (severity, message, details = {}) => {
  if (severity === 'error') errors++;
  if (severity === 'warning') warnings++;
  const item = { severity, code: details.code || 'GENERAL', message, ...details };
  if (!item.file) item.file = inferFile(message);
  report.items.push(item);
  if (!JSON_MODE) {
    const prefix = severity === 'error' ? '  ✗ ' : severity === 'warning' ? '  ⚠ ' : '  ℹ ';
    (severity === 'error' ? originalError : originalLog)(prefix + message);
  }
};

const err = (msg, details = {}) => record('error', msg, details);
const warn = (msg, details = {}) => record('warning', msg, details);
const info = (msg, details = {}) => record('info', msg, details);

const topics = JSON.parse(readFileSync(join(root, 'src', 'data', 'topics.json'), 'utf8'));
const categoryFor = (type) => topics.find((topic) => topic.type === type)?.name || type;

// 极简 frontmatter 解析（支持 key: value、引号字符串、- 列表、[a, b] 行内数组）
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
      let val = kv[2].trim();
      if (val === '' ) {
        attrs[key] = [];
        current = key;
        continue;
      }
      if (val.startsWith('[') && val.endsWith(']')) {
        attrs[key] = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      } else {
        attrs[key] = val.replace(/^["']|["']$/g, '');
      }
      current = key;
    }
  }
  return { attrs, body };
}

function readDir(dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => /\.mdx?$/.test(f))
    .sort()
    .map((f) => {
      const rel = `${dir}/${f}`;
      const raw = readFileSync(join(root, rel), 'utf8');
      const { attrs, body } = parseFrontmatter(raw);
      return { file: f, rel, slug: f.replace(/\.(md|mdx)$/, ''), attrs, body };
    });
}

// ── 专题归属：category 必须与所在文件夹一致（专题由文件夹决定，勿手改）──
function checkCategory(item, expected) {
  const got = item.attrs.category;
  const val = Array.isArray(got) ? '' : String(got ?? '');
  if (val && val !== expected) {
    err(`[${item.rel}] category 为「${val}」，应为「${expected}」（专题由所在文件夹决定，模板已锁死，请勿手改）`);
  }
}

// ── 封面图：cover 若是相对路径，必须存在于 public/ 下 ──
function checkCover(item) {
  const c = typeof item.attrs.cover === 'string' ? item.attrs.cover : '';
  if (!c || /^https?:\/\//i.test(c)) return;
  const p = join(root, 'public', c.replace(/^\/+/, ''));
  if (!existsSync(p)) warn(`[${item.rel}] cover 指向 public 下不存在的文件：${c}`);
}

// ── 图片存在性检查 ──
const IMG_RE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
function checkImages(item) {
  let m;
  IMG_RE.lastIndex = 0;
  while ((m = IMG_RE.exec(item.body))) {
    const src = m[1];
    if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) continue; // 远程/内联
    if (src.startsWith('/')) {
      const rel = src.startsWith(BASE) ? src.slice(BASE.length) : src;
      const p = join(root, 'public', rel.replace(/^\//, ''));
      if (!existsSync(p)) warn(`[${item.rel}] 引用了 public 下不存在的图片：${src}`);
      continue;
    }
    const p = resolve(join(root, dirname(item.rel)), src);
    if (!existsSync(p)) err(`[${item.rel}] 相对路径图片不存在：${src}`);
  }
}

console.log('内容体检中……\n');

// ── 1. 正文（blog）──
const posts = readDir('content/blog');
report.stats.blogPosts = posts.length;
const slugs = new Set(posts.map((p) => p.slug));
console.log(`📄 正文：${posts.length} 篇`);
for (const p of posts) {
  const a = p.attrs;
  const ctx = `[${p.rel}]`;
  if (!a.title) err(`${ctx} 缺少 title`);
  else if (String(a.title).length > 40) warn(`${ctx} 标题偏长（${String(a.title).length} 字），建议 ≤40`);
  if (!a.description) err(`${ctx} 缺少 description`);
  if (!a.pubDate) err(`${ctx} 缺少 pubDate`);
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(a.pubDate)) err(`${ctx} pubDate 格式应为 YYYY-MM-DD，当前为 ${a.pubDate}`);
  if (a.status !== undefined && !ALLOWED_STATUS.includes(a.status)) err(`${ctx} status 非法：${a.status}（允许 ${ALLOWED_STATUS.join(' / ')}）`);
  if (a.status && a.status !== 'published') err(`${ctx} 状态为 ${a.status}，位于公开区 content/blog/，不会被发布。草稿请放 content/drafts/，私密请放 content/private/`);
  checkCategory(p, categoryFor('blog'));
  checkCover(p);
  for (const kind of ['references', 'links']) {
    const arr = a[kind];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    for (const ref of arr) if (!slugs.has(ref)) err(`${ctx} ${kind} 指向不存在的文章 slug「${ref}」`);
  }
  checkImages(p);
}

// ── 2. 随笔（talk）──
const talks = readDir('content/talk');
report.stats.talks = talks.length;
console.log(`✍️ 随笔：${talks.length} 篇`);
for (const t of talks) {
  const a = t.attrs;
  const ctx = `[${t.rel}]`;
  if (!a.title) warn(`${ctx} 未设置 title，卡片会退化为文件名「${t.slug}」`);
  if (!a.update) warn(`${ctx} 缺少 update（日期），排序会失效`);
  else if (!/^\d{4}-\d{2}-\d{2}(-\d{2}:\d{2})?$/.test(a.update)) warn(`${ctx} update 建议格式 YYYY-MM-DD 或 YYYY-MM-DD-HH:mm，当前为 ${a.update}`);
  checkCategory(t, categoryFor('talk'));
  checkCover(t);
  checkImages(t);
}

// ── 3. 应用（apps）──
const apps = readDir('content/apps');
report.stats.apps = apps.length;
console.log(`🧩 应用：${apps.length} 个`);
for (const a of apps) {
  const d = a.attrs;
  const ctx = `[${a.rel}]`;
  if (!d.name) err(`${ctx} 缺少 name`);
  if (!d.description) err(`${ctx} 缺少 description`);
  if (!d.url && !d.repo) warn(`${ctx} 既没有 url 也没有 repo，读者无法访问`);
  checkCategory(a, categoryFor('apps'));
  checkCover(a);
  checkImages(a);
}

// ── 4. 标签规范 ──
const tagCount = new Map();
for (const p of posts) {
  const tags = Array.isArray(p.attrs.tags) ? p.attrs.tags : [];
  for (const t of tags) {
    if (t !== t.trim()) warn(`[${p.rel}] 标签「${t}」含首尾空格，会导致筛选失效`);
    const key = t.trim();
    tagCount.set(key, (tagCount.get(key) || 0) + 1);
  }
}
report.stats.tags = tagCount.size;
if (tagCount.size) {
  const single = [...tagCount.entries()].filter(([, c]) => c === 1).map(([t]) => t);
  console.log(`🏷️ 标签：${tagCount.size} 个`);
  if (single.length) info(`仅出现 1 次的标签：${single.join('、')}（可考虑合并或复用）`);
}

// ── 5. 孤岛检测 ──
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
    warn(`[${p.rel}] 是孤岛文章：没有任何引用/连接。建议加 links 或 references 连到旧文章。`);
  }
}

// ── 6. 体积检查（图片过大提醒）──
const MAX_IMG = 3 * 1024 * 1024;
function walk(dir, out = []) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const full = join(abs, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(join(dir, entry), out);
    else if (/\.(png|jpe?g|gif|webp)$/i.test(entry)) out.push({ rel: join(dir, entry).replace(/\\/g, '/'), size: st.size });
  }
  return out;
}
const bigImages = [...walk('src/assets'), ...walk('public')].filter((i) => i.size > MAX_IMG);
report.stats.bigImages = bigImages.length;
if (bigImages.length) {
  info(`有 ${bigImages.length} 张图片超过 3MB（构建会变慢，建议压缩）：`);
  bigImages.sort((a, b) => b.size - a.size).slice(0, 5).forEach((i) => info(`  ${i.rel} — ${(i.size / 1024 / 1024).toFixed(1)}MB`));
}

// ── 7. 泄密风险扫描（针对 git 已跟踪文件）──
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
    if (!/\.md$/.test(rel) || !/^content\//.test(rel)) continue;
    const content = readFileSync(join(root, rel), 'utf8');
    if (content.includes('PRIVATE_PASSWORD')) warn(`${rel} 中出现 PRIVATE_PASSWORD 字样，请确认未泄露真实密码`);
  }
}

console.log('');
secretScan();

report.errors = errors;
report.warnings = warnings;
report.ok = errors === 0;

if (JSON_MODE) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(errors > 0 ? 1 : 0);
}

console.log(`\n检查完成：${errors} 个错误，${warnings} 个警告`);
if (errors > 0) {
  console.error('❌ 存在错误，请修复后再提交。');
  process.exit(1);
}
if (warnings > 0) console.warn('⚠ 存在警告，建议处理后再提交。');
else console.log('✅ 内容健康检查通过');
