import { beforeEach, describe, expect, it, vi } from 'vitest';
import { command } from './create-references.js';
import type { createReferences } from '@mtlx-fidelity/core';

const { createReferencesMock } = vi.hoisted(() => ({
  createReferencesMock: vi.fn<typeof createReferences>(),
}));

vi.mock('@mtlx-fidelity/core', () => ({
  createReferences: createReferencesMock,
}));

describe('create-references command', () => {
  beforeEach(() => {
    createReferencesMock.mockReset();
    createReferencesMock.mockResolvedValue({
      adapterNames: ['materialxview'],
      total: 6,
      attempted: 6,
      rendered: 6,
      failures: [],
      stopped: false,
    });
  });

  it('invokes core createReferences with parsed options', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(2_234);

    try {
      await command.handler({
        adapters: ['materialxview'],
        materials: undefined,
        filter: undefined,
        'third-party-root': '../',
        thirdPartyRoot: '../',
        'adapters-root': './adapters',
        adaptersRoot: './adapters',
        'screen-width': 256,
        screenWidth: 256,
        'screen-height': 256,
        screenHeight: 256,
        concurrency: 2,
        _: [],
        $0: 'mtlx-fidelity',
      });

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        'Rendered 6/6 images with adapters "materialxview". Failures: 0. Time: 1.23 s\n',
      );
    } finally {
      dateNowSpy.mockRestore();
      stdoutWriteSpy.mockRestore();
    }

    expect(createReferencesMock).toHaveBeenCalledTimes(1);
    const [firstCall] = createReferencesMock.mock.calls;
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toMatchObject({
      adapterNames: ['materialxview'],
      thirdPartyRoot: expect.any(String),
      concurrency: 2,
      screenWidth: 256,
      screenHeight: 256,
    });
  });

  it('passes materials selectors through to core createReferences', async () => {
    await command.handler({
      adapters: ['materialxview,threejs'],
      materials: ['standard_surface', '/gltf_pbr/i'],
      filter: 'stdlib',
      'third-party-root': '../',
      thirdPartyRoot: '../',
      'adapters-root': './adapters',
      adaptersRoot: './adapters',
      'screen-width': 256,
      screenWidth: 256,
      'screen-height': 256,
      screenHeight: 256,
      concurrency: 1,
      _: [],
      $0: 'mtlx-fidelity',
    });

    const [firstCall] = createReferencesMock.mock.calls;
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toMatchObject({
      adapterNames: ['materialxview', 'threejs'],
      materialSelectors: ['standard_surface', '/gltf_pbr/i', 'stdlib'],
    });
  });

  it('defaults to all adapters when --adapters is omitted', async () => {
    await command.handler({
      adapters: undefined,
      materials: undefined,
      filter: undefined,
      'third-party-root': '../',
      thirdPartyRoot: '../',
      'adapters-root': './adapters',
      adaptersRoot: './adapters',
      'screen-width': 256,
      screenWidth: 256,
      'screen-height': 256,
      screenHeight: 256,
      concurrency: 1,
      _: [],
      $0: 'mtlx-fidelity',
    });

    const [firstCall] = createReferencesMock.mock.calls;
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toMatchObject({
      adapterNames: [],
      materialSelectors: [],
    });
  });
});
