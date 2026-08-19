/**
 * QR Code generation.
 *
 * The voucher "QR" used to be a decorative grid of pseudo-random squares — it
 * looked the part on a slide but no scanner could read it. This produces a real
 * QR symbol so a phone camera opens the voucher.
 *
 * Scope is deliberately narrow: byte mode, error-correction level M, versions
 * 1–10. That covers a URL of up to 213 bytes, which is far more than a voucher
 * link needs, and keeps the tables small enough to read.
 *
 * Reference: ISO/IEC 18004.
 */

export type QrMatrix = boolean[][];

/** Error-correction level M: recovers ~15% damage. */
const EC_CODEWORDS_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];

/** [group 1 blocks, group 1 data codewords, group 2 blocks, group 2 data codewords] */
const BLOCK_LAYOUT: [number, number, number, number][] = [
  [1, 16, 0, 0],  // v1
  [1, 28, 0, 0],  // v2
  [1, 44, 0, 0],  // v3
  [2, 32, 0, 0],  // v4
  [2, 43, 0, 0],  // v5
  [4, 27, 0, 0],  // v6
  [4, 31, 0, 0],  // v7
  [2, 38, 2, 39], // v8
  [3, 36, 2, 37], // v9
  [4, 43, 1, 44], // v10
];

/** Row/column centres of the alignment patterns, by version. */
const ALIGNMENT_CENTRES: number[][] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30],
  [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

/** Pre-computed version information bit strings, needed from version 7 up. */
const VERSION_INFO: Record<number, number> = {
  7: 0x07C94, 8: 0x085BC, 9: 0x09A99, 10: 0x0A4D3,
};

// ── Galois field arithmetic (GF(256), primitive polynomial 0x11D) ───────────

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** Generator polynomial for `degree` error-correction codewords. */
function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Reed-Solomon remainder: the error-correction codewords for one block. */
function ecCodewords(data: number[], count: number): number[] {
  const gen = generatorPoly(count);
  const remainder = new Array(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < count; i += 1) {
      remainder[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return remainder;
}

// ── Encoding ────────────────────────────────────────────────────────────────

/** Data capacity in bytes for byte mode at level M, by version. */
function dataCapacity(version: number): number {
  const [g1, dc1, g2, dc2] = BLOCK_LAYOUT[version - 1];
  const total = g1 * dc1 + g2 * dc2;
  // Mode indicator (4 bits) + character count indicator (8 or 16 bits).
  return total - 2 - (version >= 10 ? 1 : 0);
}

function chooseVersion(byteLength: number): number {
  for (let version = 1; version <= 10; version += 1) {
    if (byteLength <= dataCapacity(version)) return version;
  }
  throw new Error(`Payload of ${byteLength} bytes is too long for a version 10 QR code`);
}

class BitBuffer {
  private bits: number[] = [];
  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i -= 1) this.bits.push((value >>> i) & 1);
  }
  get length(): number { return this.bits.length; }
  toBytes(): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (this.bits[i + j] ?? 0);
      bytes.push(byte);
    }
    return bytes;
  }
}

/** Data codewords: encoded payload, terminated and padded to capacity. */
function buildDataCodewords(bytes: number[], version: number): number[] {
  const [g1, dc1, g2, dc2] = BLOCK_LAYOUT[version - 1];
  const totalData = g1 * dc1 + g2 * dc2;
  const countBits = version >= 10 ? 16 : 8;

  const buffer = new BitBuffer();
  buffer.put(0b0100, 4);            // byte mode
  buffer.put(bytes.length, countBits);
  for (const byte of bytes) buffer.put(byte, 8);

  // Terminator, up to four zero bits, then pad to a byte boundary.
  const capacityBits = totalData * 8;
  const terminator = Math.min(4, capacityBits - buffer.length);
  buffer.put(0, terminator);
  if (buffer.length % 8 !== 0) buffer.put(0, 8 - (buffer.length % 8));

  const codewords = buffer.toBytes();
  // Alternating pad bytes, as specified.
  const PAD = [0xec, 0x11];
  for (let i = 0; codewords.length < totalData; i += 1) codewords.push(PAD[i % 2]);
  return codewords;
}

/** Splits into blocks, appends error correction, and interleaves. */
function interleave(dataCodewords: number[], version: number): number[] {
  const [g1, dc1, g2, dc2] = BLOCK_LAYOUT[version - 1];
  const ecCount = EC_CODEWORDS_PER_BLOCK[version - 1];

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < g1 + g2; i += 1) {
    const size = i < g1 ? dc1 : dc2;
    const block = dataCodewords.slice(offset, offset + size);
    offset += size;
    dataBlocks.push(block);
    ecBlocks.push(ecCodewords(block, ecCount));
  }

  const result: number[] = [];
  const maxData = Math.max(dc1, dc2);
  for (let i = 0; i < maxData; i += 1) {
    for (const block of dataBlocks) if (i < block.length) result.push(block[i]);
  }
  for (let i = 0; i < ecCount; i += 1) {
    for (const block of ecBlocks) result.push(block[i]);
  }
  return result;
}

// ── Matrix construction ─────────────────────────────────────────────────────

type Grid = { modules: (boolean | null)[][]; reserved: boolean[][]; size: number };

function createGrid(size: number): Grid {
  return {
    size,
    modules: Array.from({ length: size }, () => new Array(size).fill(null)),
    reserved: Array.from({ length: size }, () => new Array(size).fill(false)),
  };
}

function place(grid: Grid, row: number, col: number, dark: boolean, reserve = true): void {
  grid.modules[row][col] = dark;
  if (reserve) grid.reserved[row][col] = true;
}

function drawFinder(grid: Grid, row: number, col: number): void {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= grid.size || cc < 0 || cc >= grid.size) continue;
      const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6))
        || (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      place(grid, rr, cc, inRing || inCore);
    }
  }
}

function drawAlignment(grid: Grid, version: number): void {
  const centres = ALIGNMENT_CENTRES[version - 1];
  for (const row of centres) {
    for (const col of centres) {
      // Skip the three corners already occupied by finder patterns.
      const last = grid.size - 7;
      if ((row === 6 && col === 6) || (row === 6 && col === last) || (row === last && col === 6)) continue;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const ring = Math.max(Math.abs(r), Math.abs(c));
          place(grid, row + r, col + c, ring !== 1);
        }
      }
    }
  }
}

function drawTiming(grid: Grid): void {
  for (let i = 8; i < grid.size - 8; i += 1) {
    const dark = i % 2 === 0;
    place(grid, 6, i, dark);
    place(grid, i, 6, dark);
  }
}

function reserveFormatAreas(grid: Grid, version: number): void {
  for (let i = 0; i < 9; i += 1) {
    if (grid.modules[8][i] === null) place(grid, 8, i, false);
    if (grid.modules[i][8] === null) place(grid, i, 8, false);
  }
  for (let i = 0; i < 8; i += 1) {
    place(grid, 8, grid.size - 1 - i, false);
    place(grid, grid.size - 1 - i, 8, false);
  }
  // The dark module is always set, just above the lower-left format strip.
  place(grid, grid.size - 8, 8, true);

  if (version >= 7) {
    const info = VERSION_INFO[version];
    for (let i = 0; i < 18; i += 1) {
      const dark = ((info >> i) & 1) === 1;
      const row = Math.floor(i / 3);
      const col = grid.size - 11 + (i % 3);
      place(grid, row, col, dark);
      place(grid, col, row, dark);
    }
  }
}

const MASKS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** Zigzag placement of the interleaved codewords, applying the mask as it goes. */
function placeData(grid: Grid, codewords: number[], mask: number): void {
  const maskFn = MASKS[mask];
  let bitIndex = 0;
  let upward = true;

  for (let right = grid.size - 1; right > 0; right -= 2) {
    // Column 6 is the vertical timing pattern and is skipped entirely.
    if (right === 6) right = 5;
    for (let step = 0; step < grid.size; step += 1) {
      const row = upward ? grid.size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (grid.reserved[row][col]) continue;
        const byte = codewords[bitIndex >>> 3] ?? 0;
        const bit = ((byte >>> (7 - (bitIndex & 7))) & 1) === 1;
        grid.modules[row][col] = bit !== maskFn(row, col);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

/** Format information for level M with the chosen mask, BCH-encoded. */
function writeFormatInfo(grid: Grid, mask: number): void {
  const data = (0b00 << 3) | mask; // 00 = level M
  let bch = data << 10;
  for (let i = 4; i >= 0; i -= 1) {
    if ((bch >> (i + 10)) & 1) bch ^= 0b10100110111 << i;
  }
  const format = ((data << 10) | bch) ^ 0b101010000010010;

  const n = grid.size;
  for (let i = 0; i < 15; i += 1) {
    const dark = ((format >> i) & 1) === 1;
    // Vertical run: down the left of the top-left finder, then the bottom-left
    // strip. Row `n - 8` is skipped here — that is the dark module.
    if (i < 6) grid.modules[i][8] = dark;
    else if (i < 8) grid.modules[i + 1][8] = dark;
    else grid.modules[n - 15 + i][8] = dark;
    // Horizontal run: right of the top-left finder, then the top-right strip.
    if (i < 8) grid.modules[8][n - i - 1] = dark;
    else if (i === 8) grid.modules[8][7] = dark;
    else grid.modules[8][14 - i] = dark;
  }
}

/** Penalty score used to pick the least visually confusing mask. */
function penalty(grid: Grid): number {
  const n = grid.size;
  const at = (r: number, c: number) => grid.modules[r][c] === true;
  let score = 0;

  // Rule 1: runs of five or more same-coloured modules in a row or column.
  for (let i = 0; i < n; i += 1) {
    for (const horizontal of [true, false]) {
      let run = 1;
      for (let j = 1; j < n; j += 1) {
        const cur = horizontal ? at(i, j) : at(j, i);
        const prev = horizontal ? at(i, j - 1) : at(j - 1, i);
        if (cur === prev) {
          run += 1;
        } else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }

  // Rule 2: 2x2 blocks of one colour.
  for (let r = 0; r < n - 1; r += 1) {
    for (let c = 0; c < n - 1; c += 1) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3;
    }
  }

  // Rule 3: finder-like 1:1:3:1:1 patterns with four light modules beside them.
  const A = [true, false, true, true, true, false, true, false, false, false, false];
  const B = [false, false, false, false, true, false, true, true, true, false, true];
  const matches = (get: (k: number) => boolean, start: number, pattern: boolean[]) =>
    pattern.every((want, k) => get(start + k) === want);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= n - 11; j += 1) {
      if (matches(k => at(i, k), j, A) || matches(k => at(i, k), j, B)) score += 40;
      if (matches(k => at(k, i), j, A) || matches(k => at(k, i), j, B)) score += 40;
    }
  }

  // Rule 4: deviation from an even balance of dark and light.
  let dark = 0;
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (at(r, c)) dark += 1;
  const percent = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/**
 * Encodes `text` and returns the module matrix — `true` is a dark module.
 * Every mask is trialled and the lowest-penalty one is kept, as the spec
 * requires; scanners rely on that choice being made properly.
 */
export function encodeQr(text: string): QrMatrix {
  const bytes = [...new TextEncoder().encode(text)];
  const version = chooseVersion(bytes.length);
  const size = 17 + version * 4;
  const codewords = interleave(buildDataCodewords(bytes, version), version);

  let best: Grid | null = null;
  let bestScore = Infinity;

  for (let mask = 0; mask < 8; mask += 1) {
    const grid = createGrid(size);
    drawFinder(grid, 0, 0);
    drawFinder(grid, 0, size - 7);
    drawFinder(grid, size - 7, 0);
    drawAlignment(grid, version);
    drawTiming(grid);
    reserveFormatAreas(grid, version);
    placeData(grid, codewords, mask);
    writeFormatInfo(grid, mask);

    const score = penalty(grid);
    if (score < bestScore) {
      bestScore = score;
      best = grid;
    }
  }

  return best!.modules.map(row => row.map(cell => cell === true));
}

/**
 * The matrix as an SVG path string, one subpath per dark module, sized in
 * module units. Rendering as a single path keeps the DOM to one node rather
 * than one per module — a version 3 symbol is nearly 1,000 modules.
 */
export function qrPath(matrix: QrMatrix): string {
  const parts: string[] = [];
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = 0; c < matrix.length; c += 1) {
      if (matrix[r][c]) parts.push(`M${c} ${r}h1v1h-1z`);
    }
  }
  return parts.join('');
}
