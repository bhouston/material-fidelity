import path from 'node:path';
import { availableParallelism } from 'node:os';
import { calculateMetrics } from '@material-fidelity/core';
import type { CalculateMetricsResult, FidelityRenderer } from '@material-fidelity/core';
import {
  createEeveeNodesRenderer as createBlenderEeveeNodesRenderer,
  createNodesRenderer as createBlenderNodesRenderer,
  createRenderer as createBlenderRenderer,
} from '@material-fidelity/renderer-blender';
import { createRenderer as createMaterialXViewRenderer } from '@material-fidelity/renderer-materialxview';
import {
  createCurrentRenderer as createThreeJsCurrentRenderer,
  createRenderer as createThreeJsNewRenderer,
} from '@material-fidelity/renderer-threejs';
import { humanizeTime } from 'humanize-units';
import { defineCommand } from 'yargs-file-commands';

function inferRepoRoot(invocationCwd: string): string {
  if (path.basename(invocationCwd) === 'cli' && path.basename(path.dirname(invocationCwd)) === 'packages') {
    return path.dirname(path.dirname(invocationCwd));
  }

  return invocationCwd;
}

function resolveThirdPartyRoot(invocationCwd: string): string {
  const repoRoot = inferRepoRoot(invocationCwd);
  return path.join(repoRoot, 'third_party');
}

function getDefaultConcurrency(): number {
  return Math.max(1, availableParallelism());
}

function normalizeStringList(rawValues: unknown): string[] {
  const values = rawValues == null ? [] : Array.isArray(rawValues) ? rawValues : [rawValues];
  return [
    ...new Set(
      values
        .flatMap((value) => String(value).split(','))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function createBuiltInRenderers(thirdPartyRoot: string): FidelityRenderer[] {
  return [
    createBlenderRenderer({ thirdPartyRoot }),
    createBlenderNodesRenderer({ thirdPartyRoot }),
    createBlenderEeveeNodesRenderer({ thirdPartyRoot }),
    createMaterialXViewRenderer(),
    createThreeJsNewRenderer({ thirdPartyRoot }),
    createThreeJsCurrentRenderer({ thirdPartyRoot }),
  ];
}

function resolveRendererNames(renderers: FidelityRenderer[], requestedRendererNames: string[]): string[] {
  const availableRendererNames = renderers.map((renderer) => renderer.name);
  if (requestedRendererNames.length === 0) {
    return availableRendererNames;
  }

  const availableRendererNameSet = new Set(availableRendererNames);
  const missingRendererNames = requestedRendererNames.filter(
    (rendererName) => !availableRendererNameSet.has(rendererName),
  );
  if (missingRendererNames.length > 0) {
    throw new Error(
      `Renderer(s) "${missingRendererNames.join(', ')}" not found. Available renderers: ${availableRendererNames.toSorted().join(', ')}.`,
    );
  }
  return requestedRendererNames;
}

function formatMetricsResult(result: CalculateMetricsResult, elapsedSeconds: number): string {
  const elapsedFormatted = humanizeTime(elapsedSeconds, { unitSeparator: ' ' });
  const vmafText = result.vmafAvailable ? 'enabled' : 'unavailable';
  return `Updated metrics for ${result.written}/${result.total} materials with renderers ${result.rendererNames.map((name) => `"${name}"`).join(', ')}. Missing references: ${result.skippedMissingReference}. Failures: ${result.failures.length}. VMAF: ${vmafText}. Time: ${elapsedFormatted}\n`;
}

export const command = defineCommand({
  command: 'metrics',
  describe: 'Calculate visual similarity metrics for rendered PNG images.',
  builder: (yargs) =>
    yargs
      .option('renderers', {
        type: 'array',
        describe: 'Renderer names to compare. Supports repeated values and comma-separated lists.',
      })
      .option('materials', {
        type: 'array',
        describe:
          'Material selectors matched against material directory names. Supports repeated values, comma-separated values, or regex (`re:...` or `/.../flags`).',
      })
      .option('concurrency', {
        type: 'number',
        default: getDefaultConcurrency(),
        describe: 'Number of materials to process in parallel. Defaults to the recommended available parallelism.',
      })
      .option('vmaf', {
        type: 'boolean',
        default: true,
        describe: 'Calculate VMAF when ffmpeg with libvmaf is available.',
      })
      .option('filter', {
        type: 'string',
        describe: 'Deprecated alias for --materials with a single substring selector.',
      }),
  handler: async (argv) => {
    const invocationCwd = process.env.INIT_CWD ?? process.cwd();
    const thirdPartyRoot = resolveThirdPartyRoot(invocationCwd);
    const renderers = createBuiltInRenderers(thirdPartyRoot);
    const materialSelectors = normalizeStringList(argv.materials);
    if (argv.filter && argv.filter.trim().length > 0) {
      materialSelectors.push(argv.filter);
    }

    const startedAt = Date.now();
    const rendererNames = resolveRendererNames(renderers, normalizeStringList(argv.renderers));
    const result = await calculateMetrics({
      thirdPartyRoot,
      rendererNames,
      materialSelectors: [...new Set(materialSelectors)],
      concurrency: Math.max(1, argv.concurrency ?? getDefaultConcurrency()),
      includeVmaf: argv.vmaf ?? true,
      onPlan: (event) => {
        if (!event.vmafAvailable && argv.vmaf !== false) {
          process.stderr.write(
            'VMAF unavailable: ffmpeg with libvmaf was not found. Continuing with SSIM, PSNR, and RMS.\n',
          );
        }
      },
      onProgress: (event) => {
        if (event.phase !== 'finish') {
          return;
        }
        const status = event.success ? 'SUCCESS' : 'FAILED';
        process.stdout.write(
          `${path.relative(process.cwd(), event.metricsPath)} | ${status} ${event.completed}/${event.total}\n`,
        );
      },
    });
    const elapsedSeconds = Math.max(0, (Date.now() - startedAt) / 1000);
    process.stdout.write(formatMetricsResult(result, elapsedSeconds));

    if (result.failures.length > 0) {
      for (const failure of result.failures) {
        process.stderr.write(`FAILED ${failure.materialPath}: ${failure.error.message}\n`);
      }
      process.exitCode = 1;
    }
  },
});
