import { describe, expect, it } from 'vitest';
import { IDENTITY_IMAGE_EDIT, resolveImageEditOps, toggleDisplayFlip } from './image-edit.js';

const size = { width: 1000, height: 1500 };

describe('image edit geometry', () => {
  it('a whole-frame edit extracts nothing', () => {
    expect(resolveImageEditOps(IDENTITY_IMAGE_EDIT, size).extract).toBeNull();
    expect(
      resolveImageEditOps(
        { ...IDENTITY_IMAGE_EDIT, crop: { x: 0, y: 0, width: 1, height: 1 } },
        size,
      ).extract,
    ).toBeNull();
  });

  it('maps a crop straight through without rotation', () => {
    const ops = resolveImageEditOps(
      { ...IDENTITY_IMAGE_EDIT, crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 } },
      size,
    );
    expect(ops.extract).toEqual({ left: 100, top: 300, width: 500, height: 750 });
  });

  it('maps a crop drawn on a quarter-turned frame back to the original pixels', () => {
    // Frame shown is 1500 wide × 1000 high; the top-left quarter of it.
    const ops = resolveImageEditOps(
      { ...IDENTITY_IMAGE_EDIT, rotation: 90, crop: { x: 0, y: 0, width: 0.5, height: 0.5 } },
      size,
    );
    expect(ops.extract).toEqual({ left: 0, top: 750, width: 500, height: 750 });
    expect(ops.rotation).toBe(90);
  });

  it('flips along the displayed axis when turned', () => {
    expect(
      toggleDisplayFlip({ ...IDENTITY_IMAGE_EDIT, rotation: 90 }, 'horizontal').flipVertical,
    ).toBe(true);
    expect(toggleDisplayFlip(IDENTITY_IMAGE_EDIT, 'horizontal').flipHorizontal).toBe(true);
  });
});
