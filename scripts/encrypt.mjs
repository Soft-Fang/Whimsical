import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto as crypto } from 'node:crypto';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const notesDir = join(root, 'content', 'private');
const outFile = join(root, 'src', 'data', 'private-posts.json');
const iterations = 600000;

const enc = new TextEncoder();

function b64(buf) {
  return Buffer.from(buf).toString('base64');
}

function loadPassword() {
  if (process.env.PRIVATE_PASSWORD && process.env.PRIVATE_PASSWORD.trim()) {
    return process.env.PRIVATE_PASSWORD;
  }
  const envPath = join(root, '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^PRIVATE_PASSWORD\s*=\s*(.+)$/);
      if (m) return m[1].trim();
    }
  }
  return null;
}

function parseFrontmatter(md) {
  if (!md.startsWith('---')) return { attrs: {}, body: md };
  const end = md.indexOf('\n---', 3);
  if (end === -1) return { attrs: {}, body: md };
  const fm = md.slice(3, end);
  const body = md.slice(end + 4).replace(/^\r?\n/, '');
  const attrs = {};
  for (const line of fm.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) {
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      attrs[key] = val;
    }
  }
  return { attrs, body };
}

async function deriveKey(password, saltBytes, iters) {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: iters, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
}

async function encryptPost(key, postObj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    enc.encode(JSON.stringify(postObj))
  );
  return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

async function main() {
  const password = loadPassword();
  if (!password) {
    console.error('未找到密码。请先设置：');
    console.error('  PowerShell: $env:PRIVATE_PASSWORD="你的密码"; npm run encrypt');
    console.error('  或创建 .env 文件（已被 .gitignore 忽略）：PRIVATE_PASSWORD=你的密码');
    process.exit(1);
  }

  if (!existsSync(notesDir)) {
    console.error('缺少 content/private 目录，请先创建并放入 .md 笔记文件。');
    process.exit(1);
  }

  const files = readdirSync(notesDir).filter(function (f) { return f.endsWith('.md'); }).sort();
  if (files.length === 0) {
    console.error('content/private 目录里没有 .md 文件。');
    process.exit(1);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt, iterations);

  const posts = [];
  for (const f of files) {
    const raw = readFileSync(join(notesDir, f), 'utf8');
    const parsed = parseFrontmatter(raw);
    const html = marked.parse(parsed.body);
    const postObj = {
      title: parsed.attrs.title || f.replace(/\.md$/, ''),
      date: parsed.attrs.date || '',
      description: parsed.attrs.description || '',
      html: html
    };
    posts.push(await encryptPost(key, postObj));
  }

  const out = {
    v: 1,
    kdf: { salt: b64(salt), iterations: iterations, hash: 'SHA-256' },
    posts: posts
  };

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
  console.log('已加密 ' + posts.length + ' 篇私有笔记 -> ' + outFile);
  console.log('content/private/ 与 .env 不会被提交到 Git。');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
