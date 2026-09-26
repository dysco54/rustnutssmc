// Downloads each sourced garment photo (see garment-photos-manifest.json) to
// scripts/jotform/garment-photos/<localFile>. Read-only against source sites;
// writes only local files. Usage: node download-photos.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('./garment-photos-manifest.json', import.meta.url), 'utf8'));
const dir = new URL('./garment-photos/', import.meta.url);
mkdirSync(dir, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

for (const [key, g] of Object.entries(manifest.garments)) {
  try {
    const res = await fetch(g.imageUrl, { headers: { 'User-Agent': UA, Referer: g.productUrl } });
    if (!res.ok) {
      console.log('FAIL', key, res.status, g.imageUrl);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(new URL(g.localFile, dir), buf);
    console.log('OK', key, buf.length, 'bytes ->', g.localFile);
  } catch (e) {
    console.log('ERROR', key, e.message);
  }
}
