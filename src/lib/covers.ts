// B3：统一的「响应式封面」工具
// 同一张原图生成多档宽度，返回 { src, srcset }，供 <img srcset> 使用
import { getImage } from 'astro:assets';

const imgModules = import.meta.glob('/src/assets/**/*.{jpg,jpeg,png,webp}', { eager: true });
const imgList: any[] = [];
for (const mod of Object.values(imgModules)) {
  const m: any = mod;
  if (m && m.default) imgList.push(m.default);
}

export type Cover = { src: string; srcset: string } | null;

/** 按序号循环取一张插画，生成 widths 档响应式封面 */
export async function makeCover(i: number, widths: number[] = [480, 960]): Promise<Cover> {
  if (!imgList.length) return null;
  const asset = imgList[i % imgList.length];
  try {
    const opts = await Promise.all(widths.map((w) => getImage({ src: asset, width: w, format: 'webp' })));
    const src = opts[opts.length - 1].src;
    const srcset = opts.map((o, k) => `${o.src} ${widths[k]}w`).join(', ');
    return { src, srcset };
  } catch {
    return null;
  }
}