import { beforeEach, describe, expect, it, vi } from 'vitest';
import { command } from './metrics.js';
import type { calculateMetrics } from '@material-fidelity/core';

const { availableParallelismMock, calculateMetricsMock } = vi.hoisted(() => ({
  availableParallelismMock: vi.fn<() => number>(() => 8),
  calculateMetricsMock: vi.fn<typeof calculateMetrics>(),
}));

vi.mock('node:os', async (importActual) => {
  const actual = await importActual<typeof import('node:os')>();
  return {
    ...actual,
    availableParallelism: availableParallelismMock,
  };
});

vi.mock('@material-fidelity/core', async (importActual) => {
  const actual = await importActual<typeof import('@material-fidelity/core')>();
  return {
    ...actual,
    calculateMetrics: calculateMetricsMock,
  };
});

vi.mock('@material-fidelity/renderer-blender', () => ({
  createRenderer: () => ({ name: 'blender-new' }),
  createNodesRenderer: () => ({ name: 'blender-nodes' }),
  createIoBlenderMtlxRenderer: () => ({ name: 'blender-io-mtlx' }),
}));

vi.mock('@material-fidelity/renderer-materialxview', () => ({
  createRenderer: () => ({ name: 'materialxview' }),
}));

vi.mock('@material-fidelity/renderer-materialxjs', () => ({
  createRenderer: () => ({ name: 'materialxjs' }),
}));

vi.mock('@material-fidelity/renderer-threejs', () => ({
  createRenderer: () => ({ name: 'threejs-new' }),
  createCurrentRenderer: () => ({ name: 'threejs-current' }),
}));

describe('metrics command', () => {
  beforeEach(() => {
    availableParallelismMock.mockReset();
    availableParallelismMock.mockReturnValue(8);
    calculateMetricsMock.mockReset();
    calculateMetricsMock.mockResolvedValue({
      rendererNames: ['materialxview', 'threejs-new'],
      total: 2,
      attempted: 2,
      written: 2,
      failures: [],
      skippedMissingReference: 0,
      vmafAvailable: true,
    });
  });

  it('is invoked as metrics', () => {
    expect(command.command).toBe('metrics');
  });

  it('invokes core calculateMetrics with parsed options', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(2_234);

    try {
      await command.handler({
        renderers: ['materialxview,threejs-new'],
        materials: ['included', '/noise/i'],
        filter: 'stdlib',
        concurrency: 2,
        vmaf: true,
        _: [],
        $0: 'cli',
      });

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        'Updated metrics for 2/2 materials with renderers "materialxview", "threejs-new". Missing references: 0. Failures: 0. VMAF: enabled. Time: 1.23 s\n',
      );
    } finally {
      dateNowSpy.mockRestore();
      stdoutWriteSpy.mockRestore();
    }

    expect(calculateMetricsMock).toHaveBeenCalledTimes(1);
    const [firstCall] = calculateMetricsMock.mock.calls;
    expect(firstCall?.[0]).toMatchObject({
      rendererNames: ['materialxview', 'threejs-new'],
      materialSelectors: ['included', '/noise/i', 'stdlib'],
      concurrency: 2,
      includeVmaf: true,
      thirdPartyRoot: expect.any(String),
    });
    expect(firstCall?.[0].thirdPartyRoot.endsWith('/third_party')).toBe(true);
  });

  it('defaults to all built-in renderers', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await command.handler({
        renderers: undefined,
        materials: undefined,
        filter: undefined,
        concurrency: undefined,
        vmaf: false,
        _: [],
        $0: 'cli',
      } as unknown as Parameters<typeof command.handler>[0]);
    } finally {
      stdoutWriteSpy.mockRestore();
    }

    const [firstCall] = calculateMetricsMock.mock.calls;
    expect(firstCall?.[0]).toMatchObject({
      rendererNames: [
        'blender-new',
        'blender-nodes',
        'blender-io-mtlx',
        'materialxjs',
        'materialxview',
        'threejs-new',
        'threejs-current',
      ],
      materialSelectors: [],
      concurrency: 8,
      includeVmaf: false,
    });
  });
});
