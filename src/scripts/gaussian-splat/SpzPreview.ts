/** Incremental legacy SPZ payload reader. SH stays in the original compressed file. */
export class SpzPreview {
  private header = new Uint8Array(16);
  private base?: Uint8Array;
  received = 0;
  count = 0;
  version = 0;
  expectedBytes = 0;
  private rotationBytes = 0;
  private rotationStart = 0;

  push(chunk: Uint8Array) {
    if (this.received < 16) {
      const length = Math.min(16 - this.received, chunk.length);
      this.header.set(chunk.subarray(0, length), this.received);
      this.received += length;
      chunk = chunk.subarray(length);
      if (this.received < 16) return;
      const view = new DataView(this.header.buffer);
      this.version = view.getUint32(4, true);
      this.count = view.getUint32(8, true);
      if (
        view.getUint32(0, true) !== 0x5053474e ||
        ![2, 3].includes(this.version)
      ) {
        throw new Error('Progressive preview requires SPZ v2 or v3');
      }
      if (
        !this.count ||
        this.count > 10_000_000 ||
        this.header[12] > 3 ||
        this.header[13] > 24 ||
        this.header[14] & ~1
      ) {
        throw new Error('Unsupported SPZ preview header');
      }
      this.rotationBytes = this.version === 3 ? 4 : 3;
      this.rotationStart = 16 + this.count * 16;
      const baseLength = this.rotationStart + this.count * this.rotationBytes;
      this.base = new Uint8Array(baseLength);
      this.base.set(this.header);
      this.expectedBytes =
        baseLength + this.count * [0, 9, 24, 45][this.header[12]];
    }
    if (this.base && this.received < this.base.length) {
      this.base.set(
        chunk.subarray(0, this.base.length - this.received),
        this.received,
      );
    }
    this.received += chunk.length;
    if (this.received > this.expectedBytes)
      throw new Error('Unexpected SPZ payload length');
  }

  get available() {
    return this.base
      ? Math.min(
          this.count,
          Math.max(
            0,
            Math.floor(
              (this.received - this.rotationStart) / this.rotationBytes,
            ),
          ),
        )
      : 0;
  }

  snapshot(budget: number) {
    if (!this.base || !this.available)
      throw new Error('SPZ base data not ready');
    const count = Math.min(budget, this.available);
    const bytes = new Uint8Array(16 + count * (16 + this.rotationBytes));
    bytes.set(this.header);
    new DataView(bytes.buffer).setUint32(8, count, true);
    bytes[12] = 0;
    let source = 16;
    let target = 16;
    for (const width of [9, 1, 3, 3, this.rotationBytes]) {
      for (let i = 0; i < count; i++) {
        const index = Math.floor((i * this.available) / count);
        bytes.set(
          this.base.subarray(
            source + index * width,
            source + (index + 1) * width,
          ),
          target + i * width,
        );
      }
      source += this.count * width;
      target += count * width;
    }
    // All positions precede rotations: bounds are global and remain stable between previews.
    const bounds = [
      Infinity,
      Infinity,
      Infinity,
      -Infinity,
      -Infinity,
      -Infinity,
    ];
    const scale = 2 ** -this.header[13];
    for (let i = 0; i < this.count; i++) {
      for (let axis = 0; axis < 3; axis++) {
        const offset = 16 + i * 9 + axis * 3;
        const unsigned =
          this.base[offset] |
          (this.base[offset + 1] << 8) |
          (this.base[offset + 2] << 16);
        const value = ((unsigned << 8) >> 8) * scale;
        bounds[axis] = Math.min(bounds[axis], value);
        bounds[axis + 3] = Math.max(bounds[axis + 3], value);
      }
    }
    return { bytes, bounds, count };
  }

  finish() {
    if (!this.base || this.received !== this.expectedBytes)
      throw new Error('Truncated SPZ payload');
    this.base = undefined;
  }
}
