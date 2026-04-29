import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';
import { calculateImageSimilarityMetrics, calculateMetrics } from './metrics.js';

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createSolidPngBuffer(red: number, green: number, blue: number, width = 1, height = 1): Buffer {
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = red;
    png.data[offset + 1] = green;
    png.data[offset + 2] = blue;
    png.data[offset + 3] = 255;
  }
  return PNG.sync.write(png);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => rm(dir, { recursive: true, force: true })));
});

describe('calculateImageSimilarityMetrics', () => {
  it('returns perfect still-image metrics for identical images', async () => {
    const root = await makeTempDir('fidelity-metrics-');
    const referencePath = path.join(root, 'reference.png');
    const sourcePath = path.join(root, 'source.png');
    const png = createSolidPngBuffer(128, 64, 32);
    await writeFile(referencePath, png);
    await writeFile(sourcePath, png);

    const metrics = await calculateImageSimilarityMetrics(sourcePath, referencePath, { includeVmaf: false });

    expect(metrics).toEqual({
      ssim: 1,
      psnr: null,
      normalizedRgbRms: 0,
      vmaf: null,
    });
  });

  it('reports pixel differences with RMS, PSNR, and SSIM', async () => {
    const root = await makeTempDir('fidelity-metrics-');
    const referencePath = path.join(root, 'reference.png');
    const sourcePath = path.join(root, 'source.png');
    await writeFile(referencePath, createSolidPngBuffer(0, 0, 0));
    await writeFile(sourcePath, createSolidPngBuffer(255, 255, 255));

    const metrics = await calculateImageSimilarityMetrics(sourcePath, referencePath, { includeVmaf: false });

    expect(metrics.normalizedRgbRms).toBe(1);
    expect(metrics.psnr).toBe(0);
    expect(metrics.ssim).toBeLessThan(0.001);
    expect(metrics.vmaf).toBeNull();
  });

  it('fails when image dimensions differ', async () => {
    const root = await makeTempDir('fidelity-metrics-');
    const referencePath = path.join(root, 'reference.png');
    const sourcePath = path.join(root, 'source.png');
    await writeFile(referencePath, createSolidPngBuffer(0, 0, 0, 1, 1));
    await writeFile(sourcePath, createSolidPngBuffer(0, 0, 0, 2, 1));

    await expect(calculateImageSimilarityMetrics(sourcePath, referencePath, { includeVmaf: false })).rejects.toThrow(
      'Image dimensions mismatch',
    );
  });
});

describe('calculateMetrics', () => {
  it('writes per-material metrics for selected renderers', async () => {
    const root = await makeTempDir('fidelity-metrics-');
    const thirdPartyRoot = path.join(root, 'third_party');
    const materialDir = path.join(thirdPartyRoot, 'material-samples', 'materials', 'surfaces', 'gltf_pbr', 'included');
    const skippedMaterialDir = path.join(
      thirdPartyRoot,
      'material-samples',
      'materials',
      'surfaces',
      'gltf_pbr',
      'skipped',
    );
    await mkdir(materialDir, { recursive: true });
    await mkdir(skippedMaterialDir, { recursive: true });
    await writeFile(path.join(materialDir, 'included.mtlx'), '<materialx />', 'utf8');
    await writeFile(path.join(skippedMaterialDir, 'skipped.mtlx'), '<materialx />', 'utf8');
    await writeFile(path.join(materialDir, 'materialxview.png'), createSolidPngBuffer(0, 0, 0));
    await writeFile(path.join(materialDir, 'threejs-new.png'), createSolidPngBuffer(255, 255, 255));

    const result = await calculateMetrics({
      thirdPartyRoot,
      rendererNames: ['materialxview', 'threejs-new'],
      materialSelectors: ['included'],
      concurrency: 1,
      includeVmaf: false,
    });

    const metrics = JSON.parse(await readFile(path.join(materialDir, 'metrics.json'), 'utf8')) as Record<
      string,
      { ssim: number; psnr: number | null; normalizedRgbRms: number; vmaf: number | null }
    >;
    expect(result.total).toBe(1);
    expect(result.written).toBe(1);
    expect(result.failures).toHaveLength(0);
    expect(metrics.materialxview).toEqual({ ssim: 1, psnr: null, normalizedRgbRms: 0, vmaf: null });
    expect(metrics['threejs-new']?.normalizedRgbRms).toBe(1);
  });
});
