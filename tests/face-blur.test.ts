import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { pixelateFaces } from "@/lib/server/face-blur";

/** 100x100 image: left half a fine checkerboard (detail), right half plain. */
async function sample(): Promise<Buffer> {
  const px = Buffer.alloc(100 * 100 * 3);
  for (let y = 0; y < 100; y++)
    for (let x = 0; x < 100; x++) {
      const v = x < 50 ? ((x + y) % 2 ? 255 : 0) : 128;
      px.fill(v, (y * 100 + x) * 3, (y * 100 + x) * 3 + 3);
    }
  return sharp(px, { raw: { width: 100, height: 100, channels: 3 } }).png().toBuffer();
}

async function pixels(buf: Buffer) {
  return sharp(buf).raw().toBuffer({ resolveWithObject: true });
}

describe("face mosaic", () => {
  it("blocks out detail inside the face box and leaves the rest alone", async () => {
    const input = await sample();
    const out = await pixelateFaces(input, [[200, 100, 600, 400]]); // y 20~60, x 10~40 (+25% pad)
    const { data, info } = await pixels(out);
    expect([info.width, info.height]).toEqual([100, 100]);
    const at = (x: number, y: number) => data[(y * 100 + x) * info.channels];
    // Inside: neighbours inside one mosaic cell are equal (the checkerboard is gone).
    expect(at(25, 40)).toBe(at(26, 40));
    // Outside the box the checkerboard is untouched, and the plain half stays plain.
    expect(at(25, 90)).not.toBe(at(26, 90));
    expect(at(80, 40)).toBe(128);
  });

  it("returns the input unchanged when there are no faces", async () => {
    const input = await sample();
    expect(await pixelateFaces(input, [])).toBe(input);
  });
});
