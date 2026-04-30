import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createMaterialPackage } from './material-package.js';

function indexOfSequence(haystack: Uint8Array, needle: number[]): number {
  outer: for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) {
        continue outer;
      }
    }
    return index;
  }
  return -1;
}

describe('createMaterialPackage', () => {
  it('orders root mtlx first, uses STORE, and rewrites image paths to textures/', async () => {
    const base = await mkdtemp(path.join(tmpdir(), 'mtlz-test-'));
    const materialsRoot = path.join(base, 'materials');
    const materialDir = path.join(materialsRoot, 'surfaces', 'gltf_pbr', 'sample_mat');
    await mkdir(materialDir, { recursive: true });
    await writeFile(
      path.join(materialDir, 'sample_mat.mtlx'),
      `<?xml version="1.0"?>
<materialx version="1.39">
  <image name="diffuse" file="diffuse.png" />
</materialx>
`,
      'utf8',
    );
    await writeFile(path.join(materialDir, 'diffuse.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'utf8');

    const primaryPath = path.join(materialDir, 'sample_mat.mtlx');
    const pack = await createMaterialPackage({
      materialsRoot,
      materialDirectory: materialDir,
      primaryMtlxPath: primaryPath,
    });

    expect(pack.suggestedBasename).toBe('sample_mat');

    const zip = await JSZip.loadAsync(pack.bytes);
    const names = Object.keys(zip.files).filter((key) => !zip.files[key]?.dir).toSorted();
    expect(names[0]).toBe('sample_mat.mtlx');
    expect(names.includes('textures/diffuse.png')).toBe(true);

    const firstLocal = indexOfSequence(pack.bytes, [0x50, 0x4b, 0x03, 0x04]);
    expect(firstLocal).toBeGreaterThanOrEqual(0);
    const compressionMethod = pack.bytes[firstLocal + 8]! | (pack.bytes[firstLocal + 9]! << 8);
    expect(compressionMethod).toBe(0);

    const rootXml = await zip.files['sample_mat.mtlx']?.async('string');
    expect(rootXml).toBeDefined();
    expect(rootXml).toContain('textures/diffuse.png');
  });
});
