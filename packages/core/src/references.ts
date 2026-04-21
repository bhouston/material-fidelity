import path from 'node:path';
import { access, mkdir, readFile, rm } from 'node:fs/promises';
import pLimit from 'p-limit';
import { PNG } from 'pngjs';
import { findFilesByName } from './fs-utils.js';
import { loadAdapters } from './adapters.js';
import type { CreateReferencesOptions, CreateReferencesResult, FidelityAdapter, RenderFailure } from './types.js';

const VIEWER_HDR_FILENAME = 'san_giuseppe_bridge_2k.hdr';
const VIEWER_MODEL_FILENAME = 'ShaderBall.glb';
const DEFAULT_BACKGROUND_COLOR = '0,0,0';

async function assertRenderIsNotEmpty(outputPngPath: string): Promise<void> {
  const pngBytes = await readFile(outputPngPath);
  const png = PNG.sync.read(pngBytes);

  for (let pixelOffset = 0; pixelOffset < png.data.length; pixelOffset += 4) {
    const red = png.data[pixelOffset];
    const green = png.data[pixelOffset + 1];
    const blue = png.data[pixelOffset + 2];
    if (red !== 0 || green !== 0 || blue !== 0) {
      return;
    }
  }

  await rm(outputPngPath, { force: true });
  throw new Error('Render output is empty (all pixels are black).');
}

function createOutputPath(materialPath: string, adapterName: string): string {
  return path.join(path.dirname(materialPath), `${adapterName}.png`);
}

function parseMaterialSelectorAsRegex(selector: string): RegExp | undefined {
  const trimmedSelector = selector.trim();
  if (trimmedSelector.length === 0) {
    return undefined;
  }

  if (trimmedSelector.startsWith('re:')) {
    return new RegExp(trimmedSelector.slice(3), 'i');
  }

  const regexLiteralMatch = /^\/(.+)\/([dgimsuvy]*)$/.exec(trimmedSelector);
  if (regexLiteralMatch) {
    const expression = regexLiteralMatch[1];
    const flags = regexLiteralMatch[2] ?? '';
    if (!expression) {
      return undefined;
    }
    return new RegExp(expression, flags);
  }

  return undefined;
}

function materialMatchesSelector(materialPath: string, materialsRoot: string, selector: string): boolean {
  const regex = parseMaterialSelectorAsRegex(selector);
  const materialDirectory = path.dirname(materialPath);
  const relativeMaterialPath = path.relative(materialsRoot, materialPath);
  const relativeMaterialDirectory = path.relative(materialsRoot, materialDirectory);
  const matchTargets = [materialPath, materialDirectory, relativeMaterialPath, relativeMaterialDirectory].map((target) =>
    target.replaceAll('\\', '/'),
  );

  if (regex) {
    return matchTargets.some((target) => {
      regex.lastIndex = 0;
      return regex.test(target);
    });
  }

  const normalizedSelector = selector.trim().toLowerCase();
  if (normalizedSelector.length === 0) {
    return false;
  }
  return matchTargets.some((target) => target.toLowerCase().includes(normalizedSelector));
}

export async function createReferences(options: CreateReferencesOptions): Promise<CreateReferencesResult> {
  const samplesRoot = path.join(options.thirdPartyRoot, 'materialX-samples');
  const materialsRoot = path.join(samplesRoot, 'materials');
  const viewerRoot = path.join(samplesRoot, 'viewer');

  try {
    await access(samplesRoot);
  } catch {
    throw new Error(`Missing required materialX-samples directory at ${samplesRoot}.`);
  }

  try {
    await access(materialsRoot);
  } catch {
    throw new Error(`Missing required materials directory at ${materialsRoot}.`);
  }

  try {
    await access(viewerRoot);
  } catch {
    throw new Error(`Missing required viewer directory at ${viewerRoot}.`);
  }

  const materialFiles = await findFilesByName(materialsRoot, 'material.mtlx');
  if (materialFiles.length === 0) {
    throw new Error(`No material.mtlx files found under ${materialsRoot}.`);
  }
  const materialSelectors = [...new Set((options.materialSelectors ?? []).map((selector) => selector.trim()).filter(Boolean))];
  const selectedMaterialFiles =
    materialSelectors.length > 0
      ? materialFiles.filter((materialPath) =>
          materialSelectors.some((selector) => materialMatchesSelector(materialPath, materialsRoot, selector)),
        )
      : materialFiles;
  if (selectedMaterialFiles.length === 0) {
    throw new Error(`No material.mtlx files matched --materials "${materialSelectors.join(', ')}".`);
  }
  await options.onPlan?.({ materialPaths: selectedMaterialFiles });

  const hdrPath = path.join(viewerRoot, VIEWER_HDR_FILENAME);
  const modelPath = path.join(viewerRoot, VIEWER_MODEL_FILENAME);
  const missingViewerAssets: string[] = [];

  try {
    await access(hdrPath);
  } catch {
    missingViewerAssets.push(VIEWER_HDR_FILENAME);
  }

  try {
    await access(modelPath);
  } catch {
    missingViewerAssets.push(VIEWER_MODEL_FILENAME);
  }
  if (missingViewerAssets.length > 0) {
    throw new Error(
      `Missing required viewer assets under ${viewerRoot}: ${missingViewerAssets.join(', ')}.`,
    );
  }

  const adapters = await loadAdapters({
    adaptersRoot: options.adaptersRoot,
    context: {
      thirdPartyRoot: options.thirdPartyRoot,
    },
  });
  const normalizedRequestedAdapters = [...new Set((options.adapterNames ?? []).map((name) => name.trim()).filter(Boolean))];
  const selectedAdapterNames = normalizedRequestedAdapters.length > 0 ? normalizedRequestedAdapters : [...adapters.keys()];
  if (selectedAdapterNames.length === 0) {
    const available = [...adapters.keys()].toSorted().join(', ');
    throw new Error(`No adapters are available. Available adapters: ${available || '(none)'}.`);
  }
  const missingAdapterNames = selectedAdapterNames.filter((adapterName) => !adapters.has(adapterName));
  if (missingAdapterNames.length > 0) {
    const available = [...adapters.keys()].toSorted().join(', ');
    throw new Error(
      `Adapter(s) "${missingAdapterNames.join(', ')}" not found. Available adapters: ${available || '(none)'}.`,
    );
  }
  const selectedAdapters = selectedAdapterNames.map((adapterName) => adapters.get(adapterName) as FidelityAdapter);
  const failedAdapterChecks: string[] = [];
  for (const adapter of selectedAdapters) {
    const checkResult = await adapter.checkPrerequisites();
    if (!checkResult.success) {
      failedAdapterChecks.push(
        `${adapter.name}: ${checkResult.message?.trim() || 'Adapter prerequisites are not satisfied.'}`,
      );
    }
  }
  if (failedAdapterChecks.length > 0) {
    throw new Error(`Adapter prerequisites are not met:\n- ${failedAdapterChecks.join('\n- ')}`);
  }

  const failures: RenderFailure[] = [];
  let started = 0;
  let completed = 0;
  let attempted = 0;
  let stopped = false;
  const shouldStop = (): boolean => options.shouldStop?.() === true;
  const renderQueue = selectedMaterialFiles.flatMap((materialPath) =>
    selectedAdapters.map((adapter) => ({ materialPath, adapter })),
  );
  const startedAdapters: FidelityAdapter[] = [];
  try {
    for (const adapter of selectedAdapters) {
      await adapter.start();
      startedAdapters.push(adapter);
    }

    const limit = pLimit(Math.max(1, options.concurrency));
    await Promise.all(
      renderQueue.map(({ materialPath, adapter }) =>
        limit(async () => {
          if (shouldStop()) {
            stopped = true;
            return;
          }

          const outputPngPath = createOutputPath(materialPath, adapter.name);
          started += 1;
          await options.onProgress?.({
            phase: 'start',
            adapterName: adapter.name,
            materialPath,
            outputPngPath,
            total: renderQueue.length,
            started,
            completed,
          });
          await mkdir(path.dirname(outputPngPath), { recursive: true });

          let renderError: Error | undefined;
          const startedAt = Date.now();
          try {
            await adapter.generateImage({
              mtlxPath: materialPath,
              outputPngPath,
              environmentHdrPath: hdrPath,
              modelPath,
              backgroundColor: DEFAULT_BACKGROUND_COLOR,
            });
            await assertRenderIsNotEmpty(outputPngPath);
          } catch (error) {
            renderError = error instanceof Error ? error : new Error(String(error));
            failures.push({ adapterName: adapter.name, materialPath, outputPngPath, error: renderError });
          } finally {
            attempted += 1;
            completed += 1;
          }

          await options.onProgress?.({
            phase: 'finish',
            adapterName: adapter.name,
            materialPath,
            outputPngPath,
            total: renderQueue.length,
            started,
            completed,
            success: !renderError,
            durationMs: Math.max(0, Date.now() - startedAt),
            error: renderError,
          });
        }),
      ),
    );
  } finally {
    let shutdownError: Error | undefined;
    for (const adapter of startedAdapters.toReversed()) {
      try {
        await adapter.shutdown();
      } catch (error) {
        shutdownError ??= error instanceof Error ? error : new Error(String(error));
      }
    }
    if (shutdownError) {
      throw shutdownError;
    }
  }

  return {
    adapterNames: selectedAdapters.map((adapter) => adapter.name),
    total: renderQueue.length,
    attempted,
    rendered: attempted - failures.length,
    failures,
    stopped,
  };
}
