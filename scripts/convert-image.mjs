/* global document, Image */
// One-off image pipeline: rotate / inset-crop / aspect-crop / resize → WebP via Chromium canvas.
// Serves the source image through a routed fake origin so the canvas stays readable.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const tasks = JSON.parse(readFileSync(process.argv[2], 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage();
let current = { buf: Buffer.alloc(0), type: 'image/jpeg' };
await page.route('http://okrich.local/**', (route) => {
  const url = route.request().url();
  if (url.includes('/src.img')) {
    return route.fulfill({ body: current.buf, contentType: current.type });
  }
  return route.fulfill({ body: '<!doctype html><title>x</title>', contentType: 'text/html' });
});
await page.goto('http://okrich.local/');

for (const t of tasks) {
  current = {
    buf: readFileSync(t.src),
    type: t.src.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
  };
  const out = await page.evaluate(
    async ({ rotate = 0, inset = {}, aspect = 0, outWidth, quality = 0.82 }) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error('image decode failed'));
        img.src = '/src.img?' + Math.random();
      });
      const rad = (rotate * Math.PI) / 180;
      const rot = document.createElement('canvas');
      if (rotate % 180 === 0) {
        rot.width = img.width;
        rot.height = img.height;
      } else {
        rot.width = img.height;
        rot.height = img.width;
      }
      const rctx = rot.getContext('2d');
      rctx.translate(rot.width / 2, rot.height / 2);
      rctx.rotate(rad);
      rctx.drawImage(img, -img.width / 2, -img.height / 2);
      const il = (inset.left ?? 0) * rot.width;
      const it = (inset.top ?? 0) * rot.height;
      const iw = rot.width - il - (inset.right ?? 0) * rot.width;
      const ih = rot.height - it - (inset.bottom ?? 0) * rot.height;
      let cw = iw,
        ch = ih,
        cx = il,
        cy = it;
      if (aspect > 0) {
        if (iw / ih > aspect) {
          cw = ih * aspect;
          cx = il + (iw - cw) / 2;
        } else {
          ch = iw / aspect;
          cy = it + (ih - ch) / 2;
        }
      }
      const outH = Math.round(outWidth * (ch / cw));
      const cnv = document.createElement('canvas');
      cnv.width = outWidth;
      cnv.height = outH;
      cnv.getContext('2d').drawImage(rot, cx, cy, cw, ch, 0, 0, outWidth, outH);
      return { data: cnv.toDataURL('image/webp', quality), w: outWidth, h: outH };
    },
    t,
  );
  const buf = Buffer.from(out.data.split(',')[1], 'base64');
  writeFileSync(t.out, buf);
  console.log(`${t.out}  ${out.w}x${out.h}  ${(buf.length / 1024).toFixed(1)} KB`);
}
await browser.close();
