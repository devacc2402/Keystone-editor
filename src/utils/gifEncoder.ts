// Pure TypeScript Animated GIF89a encoder with 6-6-6 RGB palette quantization + LZW compression

function buildWebSafe216Palette(): Uint8Array {
  // 256-color table (216 RGB cube + 40 grayscale shades)
  const palette = new Uint8Array(256 * 3);
  let idx = 0;
  const levels = [0, 51, 102, 153, 204, 255];
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        palette[idx++] = levels[r];
        palette[idx++] = levels[g];
        palette[idx++] = levels[b];
      }
    }
  }
  for (let i = 0; i < 40; i++) {
    const v = Math.round((i / 39) * 255);
    palette[idx++] = v;
    palette[idx++] = v;
    palette[idx++] = v;
  }
  return palette;
}

const PALETTE = buildWebSafe216Palette();

function quantizeFrameToIndices(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const len = width * height;
  const indices = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    const p = i * 4;
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];

    // If near grayscale, check grayscale ramp or 6x6x6 cube
    const ri = Math.round(r / 51);
    const gi = Math.round(g / 51);
    const bi = Math.round(b / 51);
    const cubeIdx = ri * 36 + gi * 6 + bi;

    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (maxDiff <= 8) {
      const gray = Math.round((r + g + b) / 3);
      const graySlot = 216 + Math.round((gray / 255) * 39);
      const cubeR = PALETTE[cubeIdx * 3];
      const cubeG = PALETTE[cubeIdx * 3 + 1];
      const cubeB = PALETTE[cubeIdx * 3 + 2];
      const dCube = (r - cubeR) ** 2 + (g - cubeG) ** 2 + (b - cubeB) ** 2;
      const gVal = PALETTE[graySlot * 3];
      const dGray = (r - gVal) ** 2 + (g - gVal) ** 2 + (b - gVal) ** 2;
      indices[i] = dGray < dCube ? graySlot : cubeIdx;
    } else {
      indices[i] = cubeIdx;
    }
  }
  return indices;
}

function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const out: number[] = [];

  let curByte = 0;
  let curBits = 0;

  const writeBits = (code: number, size: number) => {
    curByte |= code << curBits;
    curBits += size;
    while (curBits >= 8) {
      out.push(curByte & 0xff);
      curByte >>= 8;
      curBits -= 8;
    }
  };

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map<number, number>();

  const resetDict = () => {
    dict = new Map<number, number>();
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  writeBits(clearCode, codeSize);

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
    } else {
      writeBits(prefix, codeSize);
      if (nextCode < 4096) {
        dict.set(key, nextCode++);
        if (nextCode > 1 << codeSize && codeSize < 12) {
          codeSize++;
        }
      } else {
        writeBits(clearCode, codeSize);
        resetDict();
      }
      prefix = k;
    }
  }

  writeBits(prefix, codeSize);
  writeBits(eoiCode, codeSize);
  if (curBits > 0) {
    out.push(curByte & 0xff);
  }

  return new Uint8Array(out);
}

export class GifEncoder {
  private width: number;
  private height: number;
  private delayCs: number;
  private chunks: Uint8Array[] = [];

  constructor(width: number, height: number, fps: number) {
    this.width = width;
    this.height = height;
    this.delayCs = Math.max(2, Math.round(100 / Math.max(1, fps)));
    this.writeHeader();
  }

  private pushBytes(bytes: number[] | Uint8Array) {
    this.chunks.push(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }

  private writeShort(val: number) {
    this.pushBytes([val & 0xff, (val >> 8) & 0xff]);
  }

  private writeHeader() {
    // GIF89a
    this.pushBytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    // Logical screen descriptor
    this.writeShort(this.width);
    this.writeShort(this.height);
    // GCT flag (1) + color res (7) + sort (0) + GCT size (7 -> 256 colors)
    this.pushBytes([0xf7, 0x00, 0x00]);
    // Global Color Table (256 * 3)
    this.pushBytes(PALETTE);
    // Netscape 2.0 loop extension (infinite loop)
    this.pushBytes([
      0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32,
      0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00,
    ]);
  }

  addFrame(rgba: Uint8ClampedArray) {
    // Graphic Control Extension
    this.pushBytes([
      0x21,
      0xf9,
      0x04,
      0x04,
      this.delayCs & 0xff,
      (this.delayCs >> 8) & 0xff,
      0x00,
      0x00,
    ]);

    // Image Descriptor
    this.pushBytes([0x2c]);
    this.writeShort(0);
    this.writeShort(0);
    this.writeShort(this.width);
    this.writeShort(this.height);
    this.pushBytes([0x00]); // no local color table

    // LZW Minimum Code Size
    const minCodeSize = 8;
    this.pushBytes([minCodeSize]);

    const indices = quantizeFrameToIndices(rgba, this.width, this.height);
    const compressed = lzwEncode(indices, minCodeSize);

    // Write sub-blocks up to 255 bytes
    let offset = 0;
    while (offset < compressed.length) {
      const size = Math.min(255, compressed.length - offset);
      this.pushBytes([size]);
      this.pushBytes(compressed.subarray(offset, offset + size));
      offset += size;
    }
    this.pushBytes([0x00]); // block terminator
  }

  finish(): Blob {
    this.pushBytes([0x3b]); // GIF Trailer
    const totalLen = this.chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let pos = 0;
    for (const c of this.chunks) {
      merged.set(c, pos);
      pos += c.length;
    }
    return new Blob([merged], { type: 'image/gif' });
  }
}
