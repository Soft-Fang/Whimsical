import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'icons');
mkdirSync(out, { recursive: true });
for (const size of [192, 512]) {
  await sharp(join(root, 'public', 'og.png'))
    .resize(size, size, { fit: 'cover', position: 'center' })
    .png({ compressionLevel: 9 })
    .toFile(join(out, `icon-${size}.png`));
  console.log(`icon-${size}.png 生成`);
}