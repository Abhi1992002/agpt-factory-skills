import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng, diffImages, compareDirs } from "./visual-diff.mjs";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "visual-diff.mjs");
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function ihdr(width, height, colorType, { bitDepth = 8, interlace = 0 } = {}) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(width, 0);
  b.writeUInt32BE(height, 4);
  b[8] = bitDepth;
  b[9] = colorType;
  b[12] = interlace;
  return b;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function filterRow(type, row, prev, bpp) {
  return row.map((x, i) => {
    const a = i >= bpp ? row[i - bpp] : 0;
    const b = prev[i];
    const c = i >= bpp ? prev[i - bpp] : 0;
    const pred = [0, a, b, (a + b) >> 1, paeth(a, b, c)][type];
    return (x - pred) & 0xff;
  });
}

function craftPng({ width, height, colorType, rows, filters, extraChunks = [], splitIdat = false }) {
  const bpp = rows[0].length / width;
  const zero = new Array(rows[0].length).fill(0);
  const raw = rows.flatMap((row, y) => [filters[y], ...filterRow(filters[y], row, y ? rows[y - 1] : zero, bpp)]);
  const compressed = zlib.deflateSync(Buffer.from(raw));
  const mid = Math.floor(compressed.length / 2);
  const idats = splitIdat
    ? [chunk("IDAT", compressed.subarray(0, mid)), chunk("IDAT", compressed.subarray(mid))]
    : [chunk("IDAT", compressed)];
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr(width, height, colorType)),
    chunk("tEXt", Buffer.from("Comment\0ignored")),
    ...extraChunks,
    ...idats,
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function solid(width, height, rgba) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width, height, data };
}

function withPixel(img, x, y, rgba) {
  const data = Uint8Array.from(img.data);
  data.set(rgba, (y * img.width + x) * 4);
  return { ...img, data };
}

function pixel(img, x, y) {
  const i = (y * img.width + x) * 4;
  return Array.from(img.data.subarray(i, i + 4));
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "visual-diff-"));
}

function writePng(dir, name, img) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), encodePng(img));
}

function gradient(width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([(i * 37) & 255, (i * 11) & 255, (i * 5) & 255, 255 - (i & 63)], i * 4);
  return { width, height, data };
}

test("encode then decode round-trips RGBA pixels", () => {
  const img = gradient(7, 5);
  const out = decodePng(encodePng(img));
  assert.equal(out.width, 7);
  assert.equal(out.height, 5);
  assert.deepEqual(Array.from(out.data), Array.from(img.data));
});

test("encoded PNG has valid signature and chunk CRCs", () => {
  const buf = encodePng(gradient(3, 2));
  assert.deepEqual(buf.subarray(0, 8), SIGNATURE);
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const expected = crc32(buf.subarray(off + 4, off + 8 + len));
    assert.equal(buf.readUInt32BE(off + 8 + len), expected);
    off += 12 + len;
  }
  assert.equal(off, buf.length);
});

test("identical images report 0 changed pixels", () => {
  const img = gradient(4, 4);
  assert.equal(diffImages(img, { ...img, data: Uint8Array.from(img.data) }, 0).changed, 0);
});

test("one changed pixel is detected with exact count and painted red", () => {
  const a = solid(5, 4, [10, 20, 30, 255]);
  const b = withPixel(a, 3, 2, [10, 20, 31, 255]);
  const { changed, diff } = diffImages(a, b, 0);
  assert.equal(changed, 1);
  assert.deepEqual(pixel(diff, 3, 2), [255, 0, 0, 255]);
  assert.deepEqual(pixel(diff, 0, 0), [182, 185, 188, 255]);
});

test("unchanged transparent pixels dim to white", () => {
  const a = solid(1, 1, [0, 0, 0, 0]);
  assert.deepEqual(pixel(diffImages(a, a, 0).diff, 0, 0), [255, 255, 255, 255]);
});

test("tolerance ignores small channel differences", () => {
  const a = solid(3, 3, [100, 100, 100, 255]);
  const b = withPixel(withPixel(a, 0, 0, [103, 100, 100, 255]), 1, 1, [100, 100, 100, 250]);
  assert.equal(diffImages(a, b, 0).changed, 2);
  assert.equal(diffImages(a, b, 4).changed, 1);
  assert.equal(diffImages(a, b, 5).changed, 0);
});

test("diffImages rejects different sizes", () => {
  assert.throws(() => diffImages(solid(2, 2, [0, 0, 0, 255]), solid(3, 2, [0, 0, 0, 255]), 0), /size/i);
});

test("decodes RGB (color type 2) with Sub, Up and Paeth filters", () => {
  const rows = [
    [255, 0, 0, 0, 255, 0, 0, 0, 255],
    [10, 20, 30, 40, 50, 60, 70, 80, 90],
    [200, 100, 50, 25, 12, 6, 3, 1, 0],
  ];
  const png = craftPng({ width: 3, height: 3, colorType: 2, rows, filters: [1, 2, 4], splitIdat: true });
  const img = decodePng(png);
  assert.equal(img.width, 3);
  assert.equal(img.height, 3);
  assert.deepEqual(pixel(img, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(pixel(img, 2, 1), [70, 80, 90, 255]);
  assert.deepEqual(pixel(img, 1, 2), [25, 12, 6, 255]);
});

test("decodes RGBA (color type 6) with None, Average and Paeth filters", () => {
  const rows = [
    [1, 2, 3, 4, 250, 240, 230, 220],
    [9, 8, 7, 6, 128, 129, 130, 131],
    [255, 255, 255, 0, 0, 0, 0, 255],
  ];
  const img = decodePng(craftPng({ width: 2, height: 3, colorType: 6, rows, filters: [0, 3, 4] }));
  assert.deepEqual(Array.from(img.data), rows.flat());
});

test("decodes palette (color type 3) with PLTE and tRNS", () => {
  const plte = chunk("PLTE", Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255]));
  const trns = chunk("tRNS", Buffer.from([128]));
  const rows = [
    [0, 1, 2, 1],
    [2, 2, 0, 0],
    [1, 0, 1, 2],
  ];
  const png = craftPng({ width: 4, height: 3, colorType: 3, rows, filters: [4, 3, 2], extraChunks: [plte, trns] });
  const img = decodePng(png);
  assert.deepEqual(pixel(img, 0, 0), [255, 0, 0, 128]);
  assert.deepEqual(pixel(img, 1, 0), [0, 255, 0, 255]);
  assert.deepEqual(pixel(img, 0, 1), [0, 0, 255, 255]);
  assert.deepEqual(pixel(img, 3, 2), [0, 0, 255, 255]);
});

test("decodes gray (0) and gray+alpha (4)", () => {
  const gray = decodePng(craftPng({ width: 2, height: 2, colorType: 0, rows: [[0, 128], [64, 255]], filters: [1, 4] }));
  assert.deepEqual(pixel(gray, 1, 0), [128, 128, 128, 255]);
  assert.deepEqual(pixel(gray, 0, 1), [64, 64, 64, 255]);
  const ga = decodePng(craftPng({ width: 2, height: 1, colorType: 4, rows: [[50, 100, 200, 0]], filters: [3] }));
  assert.deepEqual(pixel(ga, 0, 0), [50, 50, 50, 100]);
  assert.deepEqual(pixel(ga, 1, 0), [200, 200, 200, 0]);
});

test("rejects interlaced, 16-bit and non-PNG input with clear errors", () => {
  const idat = chunk("IDAT", zlib.deflateSync(Buffer.from([0, 0, 0, 0])));
  const iend = chunk("IEND", Buffer.alloc(0));
  const interlaced = Buffer.concat([SIGNATURE, chunk("IHDR", ihdr(1, 1, 2, { interlace: 1 })), idat, iend]);
  const deep = Buffer.concat([SIGNATURE, chunk("IHDR", ihdr(1, 1, 2, { bitDepth: 16 })), idat, iend]);
  assert.throws(() => decodePng(interlaced), /interlaced/i);
  assert.throws(() => decodePng(deep), /bit depth 16/i);
  assert.throws(() => decodePng(Buffer.from("not a png at all")), /signature/i);
});

function fixtureDirs() {
  const root = tmpDir();
  const before = path.join(root, "before");
  const after = path.join(root, "after");
  const base = solid(10, 10, [240, 240, 240, 255]);
  writePng(before, "same.png", base);
  writePng(after, "same.png", base);
  writePng(before, "changed.png", base);
  writePng(after, "changed.png", withPixel(withPixel(base, 1, 1, [0, 0, 0, 255]), 2, 2, [0, 0, 0, 255]));
  writePng(before, "resized.png", base);
  writePng(after, "resized.png", solid(10, 11, [240, 240, 240, 255]));
  writePng(before, "gone.png", base);
  writePng(after, "new.png", base);
  fs.writeFileSync(path.join(before, "notes.txt"), "ignored");
  return { root, before, after };
}

test("compareDirs reports every status and writes diff PNGs", () => {
  const { root, before, after } = fixtureDirs();
  const report = compareDirs(before, after, { tolerance: 0 });
  const byName = Object.fromEntries(report.pages.map((p) => [p.name, p]));
  assert.deepEqual(report.pages.map((p) => p.name), ["changed.png", "gone.png", "new.png", "resized.png", "same.png"]);
  assert.equal(byName["same.png"].status, "same");
  assert.equal(byName["same.png"].changed_pixels, 0);
  assert.equal(byName["changed.png"].status, "changed");
  assert.equal(byName["changed.png"].changed_pixels, 2);
  assert.equal(byName["changed.png"].changed_ratio, 0.02);
  assert.equal(byName["resized.png"].status, "size_mismatch");
  assert.equal(byName["resized.png"].diff, null);
  assert.equal(byName["gone.png"].status, "missing_after");
  assert.equal(byName["new.png"].status, "missing_before");
  assert.equal(report.total_changed_pixels, 2);
  assert.equal(report.pass, false);
  const diffPath = byName["changed.png"].diff;
  assert.equal(diffPath, path.join(root, "diff", "changed.png"));
  assert.deepEqual(pixel(decodePng(fs.readFileSync(diffPath)), 1, 1), [255, 0, 0, 255]);
  assert.ok(fs.existsSync(path.join(root, "diff", "same.png")));
});

test("compareDirs passes when every pair is identical and honors outDir", () => {
  const root = tmpDir();
  const img = gradient(6, 6);
  writePng(path.join(root, "b"), "home.png", img);
  writePng(path.join(root, "a"), "home.png", img);
  const outDir = path.join(root, "custom-diff");
  const report = compareDirs(path.join(root, "b"), path.join(root, "a"), { outDir });
  assert.equal(report.pass, true);
  assert.equal(report.total_changed_pixels, 0);
  assert.equal(report.pages[0].diff, path.join(outDir, "home.png"));
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

test("CLI writes JSON, prints a table and exits 1 on failures, 0 on pass", () => {
  const { root, before, after } = fixtureDirs();
  const jsonFile = path.join(root, "report.json");
  const fail = runCli([before, after, "--json", jsonFile, "--out", path.join(root, "d")]);
  assert.equal(fail.status, 1, fail.stderr);
  assert.match(fail.stdout, /changed\.png\s+10x10\s+2\s+2\.00%/);
  const json = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
  assert.equal(json.pass, false);
  assert.equal(json.total_changed_pixels, 2);
  assert.deepEqual(Object.keys(json.pages[0]).sort(), ["changed_pixels", "changed_ratio", "diff", "height", "name", "status", "width"]);

  const ok = runCli([before, before, "--out", path.join(root, "d2"), "--tolerance", "3"]);
  assert.equal(ok.status, 0, ok.stderr);

  const bad = runCli([before, after, "--tolerance", "300"]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /tolerance/i);
});
