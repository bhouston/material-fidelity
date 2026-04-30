import { readdir } from 'node:fs/promises';
import path from 'node:path';

/** Recursive `.mtlx` discovery — same semantics as `packages/core` `findFilesByExtension`. */
export async function findMtlxMaterialFiles(rootDir: string): Promise<string[]> {
  const normalized = '.mtlx';
  const matches: string[] = [];
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findMtlxMaterialFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === normalized) {
      matches.push(entryPath);
    }
  }

  return matches;
}
