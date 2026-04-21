import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { loadAdapters } from './adapters.js';

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => rm(dir, { recursive: true, force: true })));
});

describe('loadAdapters', () => {
  it('loads adapter modules from package main entrypoint', async () => {
    const adaptersRoot = await makeTempDir('adapters-');
    const adapterRoot = path.join(adaptersRoot, 'fake');
    await mkdir(path.join(adapterRoot, 'dist'), { recursive: true });

    await writeFile(
      path.join(adapterRoot, 'package.json'),
      JSON.stringify(
        {
          name: '@test/fake-adapter',
          main: './dist/index.js',
        },
        null,
        2,
      ),
      'utf8',
    );

    await writeFile(
      path.join(adapterRoot, 'dist/index.js'),
      `
export function createAdapter() {
  return {
    name: 'fake',
    version: '0.0.1',
    async start() {},
    async shutdown() {},
    async generateImage() {},
  };
}
`,
      'utf8',
    );

    const adapters = await loadAdapters({ adaptersRoot });
    expect(adapters.has('fake')).toBe(true);
  });
});
