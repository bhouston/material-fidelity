import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import pLimit from 'p-limit';
import {
  getMaterialsRoot,
  getSamplesRootFromThirdParty,
  materialMatchesSelector,
  metricsPathForMaterialFile,
} from '@material-fidelity/samples';
import { findMtlxMaterialFiles } from '@material-fidelity/samples-io';
import type { ImageSimilarityMetrics, MaterialMetricsFile } from '@material-fidelity/samples';
import { calculateNormalizedRgbRms, readImageAsRawRgba } from './image-empty-check.js';

const REFERENCE_RENDERER_NAME = 'materialxview';
const VMAF_IDENTICAL_SCORE = 100;

export type { ImageSimilarityMetrics, MaterialMetricsFile } from '@material-fidelity/samples';

export interface CalculateMetricsOptions {
  thirdPartyRoot: string;
  rendererNames?: string[];
  materialSelectors?: string[];
  concurrency: number;
  includeVmaf?: boolean;
  onPlan?: (event: CalculateMetricsPlanEvent) => void | Promise<void>;
  onProgress?: (event: CalculateMetricsProgressEvent) => void | Promise<void>;
}

export interface CalculateMetricsPlanEvent {
  materialPaths: string[];
  rendererNames: string[];
  vmafAvailable: boolean;
}

export interface CalculateMetricsProgressEvent {
  phase: 'start' | 'finish';
  materialPath: string;
  metricsPath: string;
  total: number;
  started: number;
  completed: number;
  rendererNames: string[];
  success?: boolean;
  error?: Error;
}

export interface MetricsFailure {
  materialPath: string;
  metricsPath: string;
  error: Error;
}

export interface CalculateMetricsResult {
  rendererNames: string[];
  total: number;
  attempted: number;
  written: number;
  failures: MetricsFailure[];
  skippedMissingReference: number;
  vmafAvailable: boolean;
}

interface RawRgbaImage {
  data: Buffer;
  width: number;
  height: number;
}

interface VmafLog {
  pooled_metrics?: {
    vmaf?: {
      mean?: unknown;
    };
  };
}

async function execFileAsync(
  file: string,
  args: string[],
  options?: { maxBuffer?: number },
): Promise<{ stdout: string; stderr: string }> {
  const { execFile } = await import('node:child_process');
  const execFilePromise = promisify(execFile);
  const result = await execFilePromise(file, args, options);
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toMetricsPath(materialPath: string): string {
  return metricsPathForMaterialFile(materialPath);
}

function toRendererImagePath(materialPath: string, rendererName: string): string {
  return path.join(path.dirname(materialPath), `${rendererName}.png`);
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function calculatePsnr(normalizedRgbRms: number): number | null {
  if (normalizedRgbRms === 0) {
    return null;
  }
  return roundMetric(-20 * Math.log10(normalizedRgbRms));
}

function calculateLumaValues(image: RawRgbaImage): Float64Array {
  const luma = new Float64Array(image.width * image.height);
  for (let sourceOffset = 0, targetOffset = 0; sourceOffset < image.data.length; sourceOffset += 4, targetOffset += 1) {
    const red = image.data[sourceOffset] ?? 0;
    const green = image.data[sourceOffset + 1] ?? 0;
    const blue = image.data[sourceOffset + 2] ?? 0;
    luma[targetOffset] = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }
  return luma;
}

function calculateSsim(sourceImage: RawRgbaImage, referenceImage: RawRgbaImage): number {
  const source = calculateLumaValues(sourceImage);
  const reference = calculateLumaValues(referenceImage);
  const pixelCount = source.length;
  if (pixelCount !== reference.length || pixelCount === 0) {
    throw new Error(`Image size mismatch: source ${source.length} pixels vs reference ${reference.length} pixels.`);
  }

  let sourceMean = 0;
  let referenceMean = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    sourceMean += source[index] ?? 0;
    referenceMean += reference[index] ?? 0;
  }
  sourceMean /= pixelCount;
  referenceMean /= pixelCount;

  let sourceVariance = 0;
  let referenceVariance = 0;
  let covariance = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const sourceDelta = (source[index] ?? 0) - sourceMean;
    const referenceDelta = (reference[index] ?? 0) - referenceMean;
    sourceVariance += sourceDelta * sourceDelta;
    referenceVariance += referenceDelta * referenceDelta;
    covariance += sourceDelta * referenceDelta;
  }

  const divisor = Math.max(1, pixelCount - 1);
  sourceVariance /= divisor;
  referenceVariance /= divisor;
  covariance /= divisor;

  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const numerator = (2 * sourceMean * referenceMean + c1) * (2 * covariance + c2);
  const denominator = (sourceMean ** 2 + referenceMean ** 2 + c1) * (sourceVariance + referenceVariance + c2);
  return roundMetric(Math.max(0, Math.min(1, numerator / denominator)));
}

async function checkVmafAvailability(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-hide_banner', '-filters'], { maxBuffer: 10 * 1024 * 1024 });
    return stdout.includes('libvmaf');
  } catch {
    return false;
  }
}

async function calculateVmaf(sourceImagePath: string, referenceImagePath: string): Promise<number | null> {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'material-fidelity-vmaf-'));
  const logPath = path.join(tempDirectory, 'vmaf.json');
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-loop',
        '1',
        '-t',
        '1',
        '-i',
        sourceImagePath,
        '-loop',
        '1',
        '-t',
        '1',
        '-i',
        referenceImagePath,
        '-lavfi',
        `[0:v]format=yuv420p[distorted];[1:v]format=yuv420p[reference];[distorted][reference]libvmaf=log_fmt=json:log_path=${logPath}`,
        '-f',
        'null',
        '-',
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    const parsed = JSON.parse(await readFile(logPath, 'utf8')) as VmafLog;
    const mean = parsed.pooled_metrics?.vmaf?.mean;
    return typeof mean === 'number' && Number.isFinite(mean) ? roundMetric(mean) : null;
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

export async function calculateImageSimilarityMetrics(
  sourceImagePath: string,
  referenceImagePath: string,
  options?: { includeVmaf?: boolean },
): Promise<ImageSimilarityMetrics> {
  const [sourceImage, referenceImage] = await Promise.all([
    readImageAsRawRgba(sourceImagePath),
    readImageAsRawRgba(referenceImagePath),
  ]);

  if (sourceImage.width !== referenceImage.width || sourceImage.height !== referenceImage.height) {
    throw new Error(
      `Image dimensions mismatch: source ${sourceImage.width}x${sourceImage.height} vs reference ${referenceImage.width}x${referenceImage.height}.`,
    );
  }

  const normalizedRgbRms = roundMetric(calculateNormalizedRgbRms(sourceImage.data, referenceImage.data));
  return {
    ssim: calculateSsim(sourceImage, referenceImage),
    psnr: calculatePsnr(normalizedRgbRms),
    normalizedRgbRms,
    vmaf: options?.includeVmaf ? await calculateVmaf(sourceImagePath, referenceImagePath) : null,
  };
}

function createPerfectMetrics(includeVmaf: boolean): ImageSimilarityMetrics {
  return {
    ssim: 1,
    psnr: null,
    normalizedRgbRms: 0,
    vmaf: includeVmaf ? VMAF_IDENTICAL_SCORE : null,
  };
}

function normalizeStringValues(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

async function calculateMetricsForMaterial(
  materialPath: string,
  rendererNames: string[],
  includeVmaf: boolean,
): Promise<MaterialMetricsFile | undefined> {
  const referenceImagePath = toRendererImagePath(materialPath, REFERENCE_RENDERER_NAME);
  if (!(await fileExists(referenceImagePath))) {
    return undefined;
  }

  const metrics: MaterialMetricsFile = {};
  for (const rendererName of rendererNames) {
    const rendererImagePath = toRendererImagePath(materialPath, rendererName);
    if (!(await fileExists(rendererImagePath))) {
      continue;
    }

    metrics[rendererName] =
      rendererName === REFERENCE_RENDERER_NAME
        ? createPerfectMetrics(includeVmaf)
        : await calculateImageSimilarityMetrics(rendererImagePath, referenceImagePath, { includeVmaf });
  }

  return metrics;
}

export async function calculateMetrics(options: CalculateMetricsOptions): Promise<CalculateMetricsResult> {
  const samplesRoot = getSamplesRootFromThirdParty(options.thirdPartyRoot);
  const materialsRoot = getMaterialsRoot(samplesRoot);

  if (!(await fileExists(samplesRoot))) {
    throw new Error(`Missing required material-samples directory at ${samplesRoot}.`);
  }
  if (!(await fileExists(materialsRoot))) {
    throw new Error(`Missing required materials directory at ${materialsRoot}.`);
  }

  const materialFiles = await findMtlxMaterialFiles(materialsRoot);
  if (materialFiles.length === 0) {
    throw new Error(`No .mtlx files found under ${materialsRoot}.`);
  }

  const materialSelectors = normalizeStringValues(options.materialSelectors);
  const selectedMaterialFiles =
    materialSelectors.length > 0
      ? materialFiles.filter((materialPath) =>
          materialSelectors.some((selector) => materialMatchesSelector(materialPath, selector)),
        )
      : materialFiles;
  if (selectedMaterialFiles.length === 0) {
    throw new Error(`No .mtlx files matched --materials "${materialSelectors.join(', ')}".`);
  }

  const rendererNames = normalizeStringValues(options.rendererNames);
  if (rendererNames.length === 0) {
    throw new Error('At least one renderer must be provided to calculate metrics.');
  }

  const vmafAvailable = options.includeVmaf === true ? await checkVmafAvailability() : false;
  await options.onPlan?.({ materialPaths: selectedMaterialFiles, rendererNames, vmafAvailable });

  const failures: MetricsFailure[] = [];
  let started = 0;
  let completed = 0;
  let attempted = 0;
  let written = 0;
  let skippedMissingReference = 0;
  const limit = pLimit(Math.max(1, options.concurrency));

  await Promise.all(
    selectedMaterialFiles.map((materialPath) =>
      limit(async () => {
        const metricsPath = toMetricsPath(materialPath);
        started += 1;
        await options.onProgress?.({
          phase: 'start',
          materialPath,
          metricsPath,
          total: selectedMaterialFiles.length,
          started,
          completed,
          rendererNames,
        });

        let error: Error | undefined;
        let success = false;
        try {
          const metrics = await calculateMetricsForMaterial(materialPath, rendererNames, vmafAvailable);
          if (!metrics) {
            skippedMissingReference += 1;
          } else {
            await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
            written += 1;
          }
          success = true;
        } catch (caughtError) {
          error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
          failures.push({ materialPath, metricsPath, error });
        }

        attempted += 1;
        completed += 1;
        await options.onProgress?.({
          phase: 'finish',
          materialPath,
          metricsPath,
          total: selectedMaterialFiles.length,
          started,
          completed,
          rendererNames,
          success,
          error,
        });
      }),
    ),
  );

  return {
    rendererNames,
    total: selectedMaterialFiles.length,
    attempted,
    written,
    failures,
    skippedMissingReference,
    vmafAvailable,
  };
}
