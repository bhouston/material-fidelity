import { readdir } from 'node:fs/promises';
import path from 'node:path';

export async function listDirectories(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(rootDir, entry.name));
}

export async function findFilesByName(rootDir: string, fileName: string): Promise<string[]> {
  const matches: string[] = [];
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findFilesByName(entryPath, fileName)));
      continue;
    }

    if (entry.isFile() && entry.name === fileName) {
      matches.push(entryPath);
    }
  }

  return matches;
}

export async function findFirstFileByExtension(rootDir: string, extension: string): Promise<string | undefined> {
  const normalized = extension.toLowerCase();
  const entries = await readdir(rootDir, { withFileTypes: true });
  const match = entries.find((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === normalized);
  return match ? path.join(rootDir, match.name) : undefined;
}
