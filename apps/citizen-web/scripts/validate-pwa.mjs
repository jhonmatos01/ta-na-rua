import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const requiredFiles = [
  'index.html',
  'offline.html',
  'sw.js',
  'manifest.webmanifest',
  'icons/app-icon-192.png',
  'icons/app-icon-512.png',
  'icons/app-icon-maskable-192.png',
  'icons/app-icon-maskable-512.png',
];

await Promise.all(requiredFiles.map((file) => readFile(join(dist, file))));

const manifest = JSON.parse(await readFile(join(dist, 'manifest.webmanifest'), 'utf8'));
if (manifest.display !== 'standalone' || manifest.start_url !== '/' || manifest.scope !== '/') {
  throw new Error('Manifesto PWA sem display, start_url ou scope esperados.');
}
if (!Array.isArray(manifest.icons) || manifest.icons.length < 4) {
  throw new Error('Manifesto PWA sem os quatro icones obrigatorios.');
}

for (const size of [192, 512]) {
  for (const name of [`app-icon-${size}.png`, `app-icon-maskable-${size}.png`]) {
    const file = await readFile(join(dist, 'icons', name));
    const width = file.readUInt32BE(16);
    const height = file.readUInt32BE(20);
    if (width !== size || height !== size) throw new Error(`${name} possui dimensoes invalidas.`);
  }
}

console.log('PWA validada: manifesto, service worker, fallback offline e icones presentes.');
