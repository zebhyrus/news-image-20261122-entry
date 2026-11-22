// news-image-20261122-entry
// Draws the front page of THE WORLD for Sunday 22 November 2026 as a
// 1024x1024 PNG, using only the Node standard library. The picture is
// drawn entirely in code: a tiny 5x7 bitmap font, rectangles, lines and
// circles, plus a hand-written PNG encoder (zlib deflate + CRC32).
// Deterministic: the same bytes come out on every run.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const WIDTH = 1024;
export const HEIGHT = 1024;

// ---- palette ---------------------------------------------------------
const PAPER: RGBA = [248, 243, 230, 255];
const INK: RGBA = [20, 20, 20, 255];
const RED: RGBA = [163, 18, 18, 255];
const GREY: RGBA = [110, 105, 92, 255];
const LIGHT: RGBA = [232, 224, 205, 255];
const BLUE: RGBA = [38, 84, 124, 255];
const SKY: RGBA = [168, 205, 225, 255];
const SAND: RGBA = [222, 196, 138, 255];
const GREEN: RGBA = [74, 110, 62, 255];
const ORANGE: RGBA = [214, 116, 44, 255];

type RGBA = [number, number, number, number];

// ---- CRC32 (PNG chunk checksums) --------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

// ---- canvas ------------------------------------------------------------
class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Buffer; // RGBA, row-major

  constructor(w: number, h: number, bg: RGBA) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 4] = bg[0];
      this.px[i * 4 + 1] = bg[1];
      this.px[i * 4 + 2] = bg[2];
      this.px[i * 4 + 3] = bg[3];
    }
  }

  set(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
    this.px[i + 3] = c[3];
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }

  // Filled circle.
  disc(cx: number, cy: number, r: number, c: RGBA): void {
    for (let y = cy - r; y <= cy + r; y++) {
      const dy = y - cy;
      const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      for (let x = cx - dx; x <= cx + dx; x++) this.set(x, y, c);
    }
  }

  // Circle outline, 1px thick.
  ring(cx: number, cy: number, r: number, c: RGBA): void {
    for (let a = 0; a < 360; a += 0.5) {
      const rad = (a * Math.PI) / 180;
      this.set(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
    }
  }

  // Bresenham line.
  line(x0: number, y0: number, x1: number, y1: number, c: RGBA): void {
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // Thick line: draw the line several times with a small offset.
  thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGBA): void {
    const half = Math.floor(t / 2);
    for (let i = -half; i <= half; i++) {
      this.line(x0 + i, y0, x1 + i, y1, c);
      this.line(x0, y0 + i, x1, y1 + i, c);
    }
  }

  // Filled triangle.
  triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGBA): void {
    const minX = Math.min(x0, x1, x2);
    const maxX = Math.max(x0, x1, x2);
    const minY = Math.min(y0, y1, y2);
    const maxY = Math.max(y0, y1, y2);
    const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    if (d === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
        const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
        const cc = 1 - a - b;
        if (a >= 0 && b >= 0 && cc >= 0) this.set(x, y, c);
      }
    }
  }

  toPng(): Buffer {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0; // filter: none
      this.px.copy(raw, y * (this.w * 4 + 1) + 1, y * this.w * 4, (y + 1) * this.w * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // colour type RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

// ---- 5x7 bitmap font ----------------------------------------------------
// Each glyph is 5 columns; each byte holds one column, bit 0 = top row.
// Classic public-domain 5x7 set, written out here by hand.
const FONT: Record<string, number[]> = {
  " ": [0x00, 0x00, 0x00, 0x00, 0x00],
  "!": [0x00, 0x00, 0x5f, 0x00, 0x00],
  '"': [0x00, 0x07, 0x00, 0x07, 0x00],
  "#": [0x14, 0x7f, 0x14, 0x7f, 0x14],
  "$": [0x24, 0x2a, 0x7f, 0x2a, 0x12],
  "%": [0x23, 0x13, 0x08, 0x64, 0x62],
  "&": [0x36, 0x49, 0x55, 0x22, 0x50],
  "'": [0x00, 0x05, 0x03, 0x00, 0x00],
  "(": [0x00, 0x1c, 0x22, 0x41, 0x00],
  ")": [0x00, 0x41, 0x22, 0x1c, 0x00],
  "*": [0x14, 0x08, 0x3e, 0x08, 0x14],
  "+": [0x08, 0x08, 0x3e, 0x08, 0x08],
  ",": [0x00, 0x50, 0x30, 0x00, 0x00],
  "-": [0x08, 0x08, 0x08, 0x08, 0x08],
  ".": [0x00, 0x60, 0x60, 0x00, 0x00],
  "/": [0x20, 0x10, 0x08, 0x04, 0x02],
  "0": [0x3e, 0x51, 0x49, 0x45, 0x3e],
  "1": [0x00, 0x42, 0x7f, 0x40, 0x00],
  "2": [0x42, 0x61, 0x51, 0x49, 0x46],
  "3": [0x21, 0x41, 0x45, 0x4b, 0x31],
  "4": [0x18, 0x14, 0x12, 0x7f, 0x10],
  "5": [0x27, 0x45, 0x45, 0x45, 0x39],
  "6": [0x3c, 0x4a, 0x49, 0x49, 0x30],
  "7": [0x01, 0x71, 0x09, 0x05, 0x03],
  "8": [0x36, 0x49, 0x49, 0x49, 0x36],
  "9": [0x06, 0x49, 0x49, 0x29, 0x1e],
  ":": [0x00, 0x36, 0x36, 0x00, 0x00],
  ";": [0x00, 0x56, 0x36, 0x00, 0x00],
  "<": [0x08, 0x14, 0x22, 0x41, 0x00],
  "=": [0x14, 0x14, 0x14, 0x14, 0x14],
  ">": [0x00, 0x41, 0x22, 0x14, 0x08],
  "?": [0x02, 0x01, 0x51, 0x09, 0x06],
  "@": [0x32, 0x49, 0x79, 0x41, 0x3e],
  A: [0x7e, 0x11, 0x11, 0x11, 0x7e],
  B: [0x7f, 0x49, 0x49, 0x49, 0x36],
  C: [0x3e, 0x41, 0x41, 0x41, 0x22],
  D: [0x7f, 0x41, 0x41, 0x22, 0x1c],
  E: [0x7f, 0x49, 0x49, 0x49, 0x41],
  F: [0x7f, 0x09, 0x09, 0x09, 0x01],
  G: [0x3e, 0x41, 0x49, 0x49, 0x7a],
  H: [0x7f, 0x08, 0x08, 0x08, 0x7f],
  I: [0x00, 0x41, 0x7f, 0x41, 0x00],
  J: [0x20, 0x40, 0x41, 0x3f, 0x01],
  K: [0x7f, 0x08, 0x14, 0x22, 0x41],
  L: [0x7f, 0x40, 0x40, 0x40, 0x40],
  M: [0x7f, 0x02, 0x0c, 0x02, 0x7f],
  N: [0x7f, 0x04, 0x08, 0x10, 0x7f],
  O: [0x3e, 0x41, 0x41, 0x41, 0x3e],
  P: [0x7f, 0x09, 0x09, 0x09, 0x06],
  Q: [0x3e, 0x41, 0x51, 0x21, 0x5e],
  R: [0x7f, 0x09, 0x19, 0x29, 0x46],
  S: [0x46, 0x49, 0x49, 0x49, 0x31],
  T: [0x01, 0x01, 0x7f, 0x01, 0x01],
  U: [0x3f, 0x40, 0x40, 0x40, 0x3f],
  V: [0x1f, 0x20, 0x40, 0x20, 0x1f],
  W: [0x3f, 0x40, 0x38, 0x40, 0x3f],
  X: [0x63, 0x14, 0x08, 0x14, 0x63],
  Y: [0x07, 0x08, 0x70, 0x08, 0x07],
  Z: [0x61, 0x51, 0x49, 0x45, 0x43],
  "[": [0x00, 0x7f, 0x41, 0x41, 0x00],
  "\\": [0x02, 0x04, 0x08, 0x10, 0x20],
  "]": [0x00, 0x41, 0x41, 0x7f, 0x00],
  "^": [0x04, 0x02, 0x01, 0x02, 0x04],
  _: [0x40, 0x40, 0x40, 0x40, 0x40],
  "`": [0x00, 0x01, 0x02, 0x04, 0x00],
  a: [0x20, 0x54, 0x54, 0x54, 0x78],
  b: [0x7f, 0x48, 0x44, 0x44, 0x38],
  c: [0x38, 0x44, 0x44, 0x44, 0x20],
  d: [0x38, 0x44, 0x44, 0x48, 0x7f],
  e: [0x38, 0x54, 0x54, 0x54, 0x18],
  f: [0x08, 0x7e, 0x09, 0x01, 0x02],
  g: [0x0c, 0x52, 0x52, 0x52, 0x3e],
  h: [0x7f, 0x08, 0x04, 0x04, 0x78],
  i: [0x00, 0x44, 0x7d, 0x40, 0x00],
  j: [0x20, 0x40, 0x44, 0x3d, 0x00],
  k: [0x7f, 0x10, 0x28, 0x44, 0x00],
  l: [0x00, 0x41, 0x7f, 0x40, 0x00],
  m: [0x7c, 0x04, 0x18, 0x04, 0x78],
  n: [0x7c, 0x08, 0x04, 0x04, 0x78],
  o: [0x38, 0x44, 0x44, 0x44, 0x38],
  p: [0x7c, 0x14, 0x14, 0x14, 0x08],
  q: [0x08, 0x14, 0x14, 0x18, 0x7c],
  r: [0x7c, 0x08, 0x04, 0x04, 0x08],
  s: [0x48, 0x54, 0x54, 0x54, 0x20],
  t: [0x04, 0x3f, 0x44, 0x40, 0x20],
  u: [0x3c, 0x40, 0x40, 0x20, 0x7c],
  v: [0x1c, 0x20, 0x40, 0x20, 0x1c],
  w: [0x3c, 0x40, 0x30, 0x40, 0x3c],
  x: [0x44, 0x28, 0x10, 0x28, 0x44],
  y: [0x0c, 0x50, 0x50, 0x50, 0x3c],
  z: [0x44, 0x64, 0x54, 0x4c, 0x44],
  "{": [0x00, 0x08, 0x36, 0x41, 0x00],
  "|": [0x00, 0x00, 0x7f, 0x00, 0x00],
  "}": [0x00, 0x41, 0x36, 0x08, 0x00],
  "~": [0x10, 0x08, 0x08, 0x10, 0x08],
};

// ---- text ---------------------------------------------------------------
const CHAR_W = 6; // 5 glyph columns + 1 blank column
const CHAR_H = 7;

function textWidth(text: string, scale: number): number {
  return text.length * CHAR_W * scale - scale; // no trailing gap
}

function drawText(cv: Canvas, text: string, x: number, y: number, scale: number, c: RGBA): void {
  let cx = x;
  for (const ch of text) {
    const glyph = FONT[ch] ?? FONT["?"];
    for (let col = 0; col < 5; col++) {
      const bits = glyph[col];
      for (let row = 0; row < 7; row++) {
        if (bits & (1 << row)) {
          cv.rect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += CHAR_W * scale;
  }
}

function drawTextCentered(cv: Canvas, text: string, cx: number, y: number, scale: number, c: RGBA): void {
  drawText(cv, text, cx - Math.floor(textWidth(text, scale) / 2), y, scale, c);
}

// Word-wrap a paragraph into lines that fit maxWidth pixels at scale.
function wrapText(text: string, scale: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draw wrapped text; returns the y just below the last line.
function drawPara(cv: Canvas, text: string, x: number, y: number, scale: number, maxWidth: number, c: RGBA, lineGap = 4): number {
  const lines = wrapText(text, scale, maxWidth);
  const lh = CHAR_H * scale + lineGap;
  lines.forEach((ln, i) => drawText(cv, ln, x, y + i * lh, scale, c));
  return y + lines.length * lh;
}

// ---- pictograms ----------------------------------------------------------
// Each draws a small scene inside the box (x, y, w, h).

function picHero(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, SKY);
  // Sun with rays.
  const sx = x + w - 52;
  const sy = y + 42;
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    cv.thickLine(
      Math.round(sx + 34 * Math.cos(rad)),
      Math.round(sy + 34 * Math.sin(rad)),
      Math.round(sx + 48 * Math.cos(rad)),
      Math.round(sy + 48 * Math.sin(rad)),
      3,
      ORANGE,
    );
  }
  cv.disc(sx, sy, 26, ORANGE);
  // Globe.
  const gx = x + 150;
  const gy = y + 150;
  cv.disc(gx, gy, 96, BLUE);
  cv.ring(gx, gy, 96, INK);
  cv.disc(gx - 34, gy - 28, 26, GREEN);
  cv.disc(gx + 30, gy - 6, 20, GREEN);
  cv.disc(gx - 8, gy + 44, 24, GREEN);
  cv.disc(gx + 52, gy + 38, 14, GREEN);
  // Ground with wind turbines.
  cv.rect(x, y + h - 46, w, 46, SAND);
  for (const tx of [x + 300, x + 330, x + 356]) {
    const ty = y + h - 46;
    cv.thickLine(tx, ty, tx, ty - 34, 2, INK);
    cv.thickLine(tx, ty - 34, tx - 10, ty - 22, 2, INK);
    cv.thickLine(tx, ty - 34, tx + 10, ty - 22, 2, INK);
    cv.thickLine(tx, ty - 34, tx, ty - 48, 2, INK);
  }
  cv.rect(x, y, w, 3, INK);
  cv.rect(x, y + h - 3, w, 3, INK);
}

function picGulf(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, LIGHT);
  cv.rect(x, y + 44, w, h - 44, BLUE);
  // Tanker hull and bridge.
  cv.rect(x + 40, y + 40, 200, 16, INK);
  cv.rect(x + 200, y + 22, 34, 18, [255, 255, 255, 255]);
  cv.rect(x + 60, y + 30, 12, 10, RED);
  cv.rect(x + 84, y + 30, 12, 10, RED);
  // Flames and smoke above the deck.
  cv.triangle(x + 120, y + 40, x + 132, y + 8, x + 144, y + 40, ORANGE);
  cv.triangle(x + 140, y + 40, x + 150, y + 16, x + 160, y + 40, RED);
  cv.disc(x + 128, y + 6, 7, GREY);
  cv.disc(x + 148, y + 2, 6, GREY);
  // Waves.
  cv.line(x + 10, y + 62, x + 60, y + 62, [255, 255, 255, 255]);
  cv.line(x + 240, y + 64, x + 290, y + 64, [255, 255, 255, 255]);
  cv.rect(x, y, w, 2, INK);
  cv.rect(x, y + h - 2, w, 2, INK);
}

function picPeru(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, LIGHT);
  // Andes peaks.
  cv.triangle(x + 10, y + h, x + 90, y + 8, x + 170, y + h, GREEN);
  cv.triangle(x + 130, y + h, x + 220, y + 2, x + 290, y + h, [90, 96, 88, 255]);
  // Snow caps.
  cv.triangle(x + 74, y + 22, x + 90, y + 8, x + 106, y + 22, [255, 255, 255, 255]);
  cv.triangle(x + 204, y + 18, x + 220, y + 2, x + 236, y + 18, [255, 255, 255, 255]);
  // Crack down the middle peak.
  cv.thickLine(x + 150, y + 10, x + 138, y + 30, 2, INK);
  cv.thickLine(x + 138, y + 30, x + 152, y + 48, 2, INK);
  cv.thickLine(x + 152, y + 48, x + 142, y + 66, 2, INK);
  // Falling rocks.
  cv.disc(x + 250, y + 40, 4, INK);
  cv.disc(x + 262, y + 52, 3, INK);
  cv.disc(x + 40, y + 46, 3, INK);
  cv.rect(x, y, w, 2, INK);
  cv.rect(x, y + h - 2, w, 2, INK);
}

function picIsrael(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, LIGHT);
  // Government building with dome (a half-disc sitting on the roof).
  cv.rect(x + 80, y + 34, 140, 32, [255, 255, 255, 255]);
  cv.rect(x + 80, y + 34, 140, 3, INK);
  cv.disc(x + 150, y + 34, 26, BLUE);
  cv.rect(x + 124, y + 6, 52, 28, LIGHT); // clip the dome's top half
  cv.rect(x + 120, y + 34, 60, 4, BLUE);
  for (const cx of [96, 122, 148, 174, 200]) {
    cv.rect(cx, y + 40, 6, 26, INK);
  }
  cv.rect(x + 70, y + 66, 160, 4, INK);
  // Flag pole and flag.
  cv.thickLine(x + 258, y + 66, x + 258, y + 10, 2, INK);
  cv.rect(x + 260, y + 10, 30, 18, [255, 255, 255, 255]);
  cv.rect(x + 260, y + 10, 30, 3, BLUE);
  cv.rect(x + 260, y + 25, 30, 3, BLUE);
  cv.rect(x, y, w, 2, INK);
  cv.rect(x, y + h - 2, w, 2, INK);
}

function picFrance(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, LIGHT);
  // Crowd heads.
  const heads: Array<[number, number, RGBA]> = [
    [60, 52, ORANGE],
    [110, 56, BLUE],
    [160, 50, RED],
    [210, 56, GREEN],
    [260, 52, ORANGE],
    [310, 56, BLUE],
    [360, 52, RED],
    [410, 56, GREEN],
  ];
  for (const [hx, hy, c] of heads) {
    cv.disc(x + hx, y + hy, 11, c);
    cv.rect(x + hx - 12, y + hy + 10, 24, h - hy - 10, INK);
  }
  // Placards on sticks.
  for (const [px, py, pw] of [
    [86, 8, 44],
    [196, 4, 52],
    [316, 10, 44],
  ] as Array<[number, number, number]>) {
    cv.thickLine(x + px + Math.floor(pw / 2), y + py + 18, x + px + Math.floor(pw / 2), y + 46, 2, INK);
    cv.rect(x + px, y + py, pw, 18, [255, 255, 255, 255]);
    cv.rect(x + px, y + py, pw, 2, INK);
    cv.rect(x + px, y + py + 16, pw, 2, INK);
  }
  cv.rect(x, y, w, 2, INK);
  cv.rect(x, y + h - 2, w, 2, INK);
}

function picKorea(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, LIGHT);
  // Exam paper (white fill with a drawn border, not a filled slab).
  cv.rect(x + 30, y + 8, 150, 54, [255, 255, 255, 255]);
  cv.rect(x + 30, y + 8, 150, 2, INK);
  cv.rect(x + 30, y + 60, 150, 2, INK);
  cv.rect(x + 30, y + 8, 2, 54, INK);
  cv.rect(x + 178, y + 8, 2, 54, INK);
  for (let i = 0; i < 4; i++) {
    cv.rect(x + 42, y + 20 + i * 10, 110 - i * 18, 3, GREY);
  }
  drawText(cv, "A+", x + 150, y + 12, 1, RED);
  // Phone with camera lens.
  cv.rect(x + 220, y + 6, 56, 58, INK);
  cv.rect(x + 226, y + 12, 44, 40, [40, 60, 80, 255]);
  cv.disc(x + 248, y + 32, 11, [255, 255, 255, 255]);
  cv.disc(x + 248, y + 32, 6, BLUE);
  cv.disc(x + 248, y + 32, 2, INK);
  // Red ring around the lens: cheating spotted.
  cv.ring(x + 248, y + 32, 16, RED);
  cv.line(x + 236, y + 20, x + 260, y + 44, RED);
  cv.rect(x, y, w, 2, INK);
  cv.rect(x, y + h - 2, w, 2, INK);
}

// ---- layout --------------------------------------------------------------
// 1024x1024 front page. Margin 36; content runs x=36..988.
const MX = 36;
const CW = 952; // content width
const RIGHT = MX + CW;

interface Story {
  kicker: string;
  headline: string;
  body: string;
  pic: (cv: Canvas, x: number, y: number, w: number, h: number) => void;
}

const HERO_HEADLINE = "CLIMATE DEAL NEARS THE LINE, BUT FOSSIL FUELS STAY OFF THE PAGE";
const HERO_KICKER = "COP31 - ANTALYA, TURKEY";
const HERO_BODY =
  "COP31 hosts Turkey and Australia put a new package to nearly 200 nations " +
  "after talks ran two days past their deadline. Delegates have until 03:00 GMT to " +
  "object; a closing session is set for 06:00 GMT on Sunday.";

const ROW1: Story[] = [
  {
    kicker: "THE GULF",
    headline: "GULF CONDEMNS IRAN STRIKES",
    body: "Arab states denounce drone attacks on US bases in Bahrain. Two tankers hit in the Hormuz Strait.",
    pic: picGulf,
  },
  {
    kicker: "PERU",
    headline: "6.7 QUAKE ROCKS PERU'S ANDES",
    body: "One killed, more than a dozen hurt in Junin. Felt in Lima; a 5.0 aftershock follows.",
    pic: picPeru,
  },
  {
    kicker: "ISRAEL",
    headline: "EISENKOT INVITES LIKUD TO TALKS",
    body: "Eisenkot asks Netanyahu's Likud to join talks starting Sunday, seeking the broadest government.",
    pic: picIsrael,
  },
];

const ROW2: Story[] = [
  {
    kicker: "FRANCE",
    headline: "FRANCE MARCHES FOR A SIXTH WEEKEND",
    body: "Largely peaceful marches over the rising cost of living roll into a sixth straight weekend. Turnout down: 82,500 in France, 21,500 in Paris.",
    pic: picFrance,
  },
  {
    kicker: "SOUTH KOREA",
    headline: "SEOUL EDUCATION CHIEF QUITS OVER AI CHEATING",
    body: "The minister resigns after the top scorer in a national tax exam admits cheating with a hidden camera and a phone.",
    pic: picKorea,
  },
];

function drawStoryCell(cv: Canvas, s: Story, x: number, y: number, w: number): void {
  const picH = 70;
  s.pic(cv, x, y, w, picH);
  drawText(cv, s.kicker, x, y + picH + 6, 2, RED);
  const headLines = wrapText(s.headline, 3, w);
  headLines.forEach((ln, i) => drawText(cv, ln, x, y + picH + 26 + i * 25, 3, INK));
  const bodyY = y + picH + 26 + headLines.length * 25 + 4;
  drawPara(cv, s.body, x, bodyY, 2, w, INK, 3);
}

function drawPage(): Canvas {
  const cv = new Canvas(WIDTH, HEIGHT, PAPER);

  // Masthead.
  cv.rect(MX, 20, CW, 3, INK);
  drawTextCentered(cv, "THE WORLD", 512, 30, 12, INK);
  cv.rect(MX, 122, CW, 3, INK);
  drawText(cv, "SIX STORIES", MX, 136, 2, GREY);
  const rightLabel = "FIVE CONTINENTS";
  drawText(cv, rightLabel, RIGHT - textWidth(rightLabel, 2), 136, 2, GREY);
  drawTextCentered(cv, "SUNDAY 22 NOVEMBER 2026", 512, 132, 3, INK);
  cv.rect(MX, 162, CW, 3, INK);

  // Hero: COP31.
  drawText(cv, HERO_KICKER, MX, 180, 2, RED);
  const heroLines = wrapText(HERO_HEADLINE, 4, 564);
  heroLines.forEach((ln, i) => drawText(cv, ln, MX, 204 + i * 33, 4, INK));
  drawPara(cv, HERO_BODY, MX, 312, 2, 564, INK, 5);
  picHero(cv, 620, 172, 368, 280);

  cv.rect(MX, 466, CW, 3, INK);

  // Row 1: three stories.
  const colW = 300;
  ROW1.forEach((s, i) => drawStoryCell(cv, s, MX + i * (colW + 26), 480, colW));

  cv.rect(MX, 712, CW, 3, INK);

  // Row 2: two stories.
  const wideW = 464;
  ROW2.forEach((s, i) => drawStoryCell(cv, s, MX + i * (wideW + 24), 726, wideW));

  cv.rect(MX, 958, CW, 3, INK);
  drawTextCentered(
    cv,
    "THE WORLD - SUNDAY 22 NOVEMBER 2026 - SIX STORIES FROM FIVE CONTINENTS",
    512,
    968,
    2,
    INK,
  );
  cv.rect(MX, 994, CW, 3, INK);

  return cv;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const png = drawPage().toPng();
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, ${WIDTH}x${HEIGHT})`);
}

main();
