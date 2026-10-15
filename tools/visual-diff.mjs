#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const RED = [255, 0, 0, 255];
const DIM_OPACITY_TENTHS = 3;
const USAGE = "Usage: node visual-diff.mjs <before-dir> <after-dir> [--out <diff-dir>] [--tolerance <0-255>] [--json <file>]";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function readChunks(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("Not a PNG: bad signature");
  }
  const chunks = [];
  let off = 8;
  while (off + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(off);
    const type = buffer.toString("ascii", off + 4, off + 8);
    const end = off + 8 + length;
    if (end + 4 > buffer.length) throw new Error(`Truncated PNG chunk ${type}`);
    chunks.push({ type, data: buffer.subarray(off + 8, end) });
    off = end + 4;
    if (type === "IEND") break;
  }
  return chunks;
}

function parseHeader(chunk) {
  if (!chunk || chunk.type !== "IHDR") throw new Error("Invalid PNG: IHDR must be the first chunk");
  const d = chunk.data;
  const header = {
    width: d.readUInt32BE(0),
    height: d.readUInt32BE(4),
    bitDepth: d[8],
    colorType: d[9],
    interlace: d[12],
  };
  if (header.interlace !== 0) throw new Error("Unsupported PNG: interlaced (Adam7) images are not supported");
  if (header.bitDepth !== 8) throw new Error(`Unsupported PNG: bit depth ${header.bitDepth} (only 8-bit is supported)`);
  if (!(header.colorType in CHANNELS)) throw new Error(`Unsupported PNG: color type ${header.colorType}`);
  return header;
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function predictor(type, a, b, c) {
  switch (type) {
    case 0: return 0;
    case 1: return a;
    case 2: return b;
    case 3: return (a + b) >> 1;
    case 4: return paethPredictor(a, b, c);
    default: throw new Error(`Invalid PNG: unknown filter type ${type}`);
  }
}

function unfilter(raw, width, height, bpp) {
  const stride = width * bpp;
  if (raw.length < height * (stride + 1)) throw new Error("Invalid PNG: image data is truncated");
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[row + i - bpp] : 0;
      const b = y > 0 ? out[row - stride + i] : 0;
      const c = i >= bpp && y > 0 ? out[row - stride + i - bpp] : 0;
      out[row + i] = (raw[src + i] + predictor(type, a, b, c)) & 0xff;
    }
  }
  return out;
}

function paletteLookup(chunks) {
  const plte = chunks.find((c) => c.type === "PLTE");
  if (!plte) throw new Error("Invalid PNG: palette image without PLTE chunk");
  const trns = chunks.find((c) => c.type === "tRNS");
  const alpha = trns ? trns.data : Buffer.alloc(0);
  return (index) => {
    if (index * 3 + 2 >= plte.data.length) throw new Error(`Invalid PNG: palette index ${index} out of range`);
    const base = index * 3;
    return [plte.data[base], plte.data[base + 1], plte.data[base + 2], index < alpha.length ? alpha[index] : 255];
  };
}

function pixelReader(colorType, chunks) {
  switch (colorType) {
    case 0: return (p, i) => [p[i], p[i], p[i], 255];
    case 2: return (p, i) => [p[i], p[i + 1], p[i + 2], 255];
    case 4: return (p, i) => [p[i], p[i], p[i], p[i + 1]];
    case 6: return (p, i) => [p[i], p[i + 1], p[i + 2], p[i + 3]];
    case 3: {
      const lookup = paletteLookup(chunks);
      return (p, i) => lookup(p[i]);
    }
  }
}

function toRgba(pixels, header, chunks) {
  const channels = CHANNELS[header.colorType];
  const read = pixelReader(header.colorType, chunks);
  const count = header.width * header.height;
  const data = new Uint8Array(count * 4);
  for (let px = 0; px < count; px++) data.set(read(pixels, px * channels), px * 4);
  return data;
}

export function decodePng(buffer) {
  const chunks = readChunks(Buffer.from(buffer));
  const header = parseHeader(chunks[0]);
  const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  if (idat.length === 0) throw new Error("Invalid PNG: no IDAT chunks");
  const raw = zlib.inflateSync(idat);
  const pixels = unfilter(raw, header.width, header.height, CHANNELS[header.colorType]);
  return { width: header.width, height: header.height, data: toRgba(pixels, header, chunks) };
}

function makeChunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

export function encodePng({ width, height, data }) {
  if (data.length !== width * height * 4) throw new Error("encodePng: data length must be width * height * 4");
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([
    SIGNATURE,
    makeChunk("IHDR", header),
    makeChunk("IDAT", zlib.deflateSync(raw)),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pixelDiffers(a, b, i, tolerance) {
  for (let c = 0; c < 4; c++) if (Math.abs(a[i + c] - b[i + c]) > tolerance) return true;
  return false;
}

function dimOverWhite(src, i) {
  const weight = DIM_OPACITY_TENTHS * src[i + 3];
  const blend = (v) => Math.round((255 * 2550 + (v - 255) * weight) / 2550);
  return [blend(src[i]), blend(src[i + 1]), blend(src[i + 2]), 255];
}

export function diffImages(a, b, tolerance = 0) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`diffImages: size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const data = new Uint8Array(b.data.length);
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const differs = pixelDiffers(a.data, b.data, i, tolerance);
    if (differs) changed++;
    data.set(differs ? RED : dimOverWhite(b.data, i), i);
  }
  return { changed, diff: { width: b.width, height: b.height, data } };
}

function listPngs(dir) {
  return fs.readdirSync(dir).filter((name) => /\.png$/i.test(name) && fs.statSync(path.join(dir, name)).isFile());
}

function missingPage(name, status) {
  return { name, width: null, height: null, changed_pixels: null, changed_ratio: null, status, diff: null };
}

function comparePair(name, beforeDir, afterDir, outDir, tolerance) {
  const before = decodePng(fs.readFileSync(path.join(beforeDir, name)));
  const after = decodePng(fs.readFileSync(path.join(afterDir, name)));
  const base = { name, width: after.width, height: after.height };
  if (before.width !== after.width || before.height !== after.height) {
    return { ...base, changed_pixels: null, changed_ratio: null, status: "size_mismatch", diff: null };
  }
  const { changed, diff } = diffImages(before, after, tolerance);
  const diffPath = path.join(outDir, name);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(diffPath, encodePng(diff));
  const total = after.width * after.height;
  return {
    ...base,
    changed_pixels: changed,
    changed_ratio: total ? changed / total : 0,
    status: changed === 0 ? "same" : "changed",
    diff: diffPath,
  };
}

export function compareDirs(beforeDir, afterDir, opts = {}) {
  const tolerance = opts.tolerance ?? 0;
  const outDir = opts.outDir ?? path.join(afterDir, "..", "diff");
  const beforeNames = new Set(listPngs(beforeDir));
  const afterNames = new Set(listPngs(afterDir));
  const names = [...new Set([...beforeNames, ...afterNames])].sort();
  const pages = names.map((name) => {
    if (!afterNames.has(name)) return missingPage(name, "missing_after");
    if (!beforeNames.has(name)) return missingPage(name, "missing_before");
    return comparePair(name, beforeDir, afterDir, outDir, tolerance);
  });
  const total_changed_pixels = pages.reduce((sum, p) => sum + (p.changed_pixels ?? 0), 0);
  return { pages, total_changed_pixels, pass: pages.every((p) => p.status === "same") };
}

function formatRow(page) {
  const size = page.width === null ? "-" : `${page.width}x${page.height}`;
  const changed = page.changed_pixels === null ? page.status : String(page.changed_pixels);
  const pct = page.changed_ratio === null ? "-" : `${(page.changed_ratio * 100).toFixed(2)}%`;
  return [page.name, size, changed, pct];
}

export function formatTable(report) {
  const rows = [["name", "size", "changed", "changed %"], ...report.pages.map(formatRow)];
  const widths = rows[0].map((_, col) => Math.max(...rows.map((r) => r[col].length)));
  const lines = rows.map((r) => r.map((cell, col) => cell.padEnd(widths[col])).join("  ").trimEnd());
  const verdict = report.pass ? "PASS" : "FAIL";
  return [...lines, "", `${verdict}: ${report.total_changed_pixels} changed pixels across ${report.pages.length} pages`].join("\n");
}

function parseTolerance(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error(`--tolerance must be an integer 0-255, got "${value}"`);
  return n;
}

export function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out" || arg === "--tolerance" || arg === "--json") {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      if (arg === "--out") opts.outDir = value;
      if (arg === "--tolerance") opts.tolerance = parseTolerance(value);
      if (arg === "--json") opts.json = value;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 2) throw new Error("Expected <before-dir> and <after-dir>");
  return { beforeDir: positional[0], afterDir: positional[1], ...opts };
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    return 2;
  }
  try {
    const report = compareDirs(args.beforeDir, args.afterDir, args);
    console.log(formatTable(report));
    if (args.json) fs.writeFileSync(args.json, `${JSON.stringify(report, null, 2)}\n`);
    return report.pass ? 0 : 1;
  } catch (err) {
    console.error(`visual-diff: ${err.message}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
