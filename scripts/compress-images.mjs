// E2：图片压缩脚本（用项目已有的 sharp）
//   node scripts/compress-images.mjs            → 只体检，列出可压缩的大图
//   node scripts/compress-images.mjs --write    → 就地压缩（会先备份到 .image-backup/）
import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const WRITE = process.argv.includes('--write');
const MIN_SIZE = 500 * 1024;   // 只处理 >500KB 的图
const MAX_WIDTH = 2000;        // 超过这个宽度会被缩小
const DIRS = ['src/assets', 'public'];
const EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function walk(dir, out = []) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs)) {
    const full = join(abs, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(join(dir, name), out);
    else if (EXT.has(extname(name).toLowerCase())) out.push({ rel: join(dir, name), abs: full, size: st.size });
  }
  return out;
}

const files = DIRS.flatMap((d) => walk(d)).filter((f) => f.size > MIN_SIZE).sort((a, b) => b.size - a.size);
if (!files.length) {
  console.log('没有超过 500KB 的图片，无需压缩。');
  process.exit(0);
}

console.log(`发现 ${files.length} 张大图（>500KB）\n`);
let saved = 0;

for (const f of files) {
  try {
    const img = sharp(f.abs);
    const meta = await img.metadata();
    let pipe = sharp(f.abs);
    if (meta.width && meta.width > MAX_WIDTH) pipe = pipe.resize({ width: MAX_WIDTH, withoutEnlargement: true });

    const ext = extname(f.abs).toLowerCase();
    if (ext === '.png') pipe = pipe.png({ compressionLevel: 9, quality: 90 });
    else if (ext === '.webp') pipe = pipe.webp({ quality: 82 });
    else pipe = pipe.jpeg({ quality: 82, mozjpeg: true });

    const buf = await pipe.toBuffer();
    const delta = f.size - buf.length;
    const pct = ((delta / f.size) * 100).toFixed(0);
    const mb = (f.size / 1024 / 1024).toFixed(1);
    const nmb = (buf.length / 1024 / 1024).toFixed(1);

    if (delta > 0) {
      console.log(`  ${f.rel}  ${mb}MB → ${nmb}MB  (-${pct}%)`);
      saved += delta;
      if (WRITE) {
        const bak = join(root, '.image-backup', f.rel);
        mkdirSync(dirname(bak), { recursive: true });
        if (!existsSync(bak)) copyFileSync(f.abs, bak);
        await sharp(buf).toFile(f.abs);
      }
    } else {
      console.log(`  ${f.rel}  ${mb}MB  （已是最优）`);
    }
  } catch (e) {
    console.log(`  ${f.rel}  处理失败：${e.message}`);
  }
}

console.log(`\n可节省约 ${(saved / 1024 / 1024).toFixed(1)} MB`);
if (!WRITE) console.log('这是「只看不写」模式；确认无误后执行：npm run compress -- --write');