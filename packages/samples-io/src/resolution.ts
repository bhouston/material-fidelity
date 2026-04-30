import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathExists } from './fs-utils.js';

export async function listMtlxFilesInDirectory(directoryPath: string): Promise<string[]> {
  if (!(await pathExists(directoryPath))) {
    return [];
  }
  const entries = await readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.mtlx')
    .map((entry) => path.join(directoryPath, entry.name))
    .toSorted((left, right) => left.localeCompare(right));
}

export async function resolveSingleMtlxFileInDirectory(directoryPath: string): Promise<string | undefined> {
  const mtlxFiles = await listMtlxFilesInDirectory(directoryPath);
  if (mtlxFiles.length !== 1) {
    return undefined;
  }
  return mtlxFiles[0];
}

export async function resolveMaterialDirectory(
  materialsRoot: string,
  materialType: string,
  materialName: string,
): Promise<string | undefined> {
  const materialsRootPrefix = `${path.resolve(materialsRoot)}${path.sep}`;
  const candidateDirectories =
    materialType === 'nodes'
      ? [path.resolve(materialsRoot, 'nodes', materialName)]
      : materialType.startsWith('showcase:')
        ? [path.resolve(materialsRoot, 'showcase', materialType.slice('showcase:'.length), materialName)]
        : [
            path.resolve(materialsRoot, 'showcase', materialType, materialName),
            path.resolve(materialsRoot, 'surfaces', materialType, materialName),
            path.resolve(materialsRoot, materialType, materialName),
          ];

  for (const targetDirectory of candidateDirectories) {
    if (!targetDirectory.startsWith(materialsRootPrefix)) {
      continue;
    }

    const materialPath = await resolveSingleMtlxFileInDirectory(targetDirectory);
    if (materialPath) {
      return targetDirectory;
    }
  }

  return undefined;
}

export async function resolveMaterialFilePath(
  materialsRoot: string,
  materialType: string,
  materialName: string,
): Promise<string | undefined> {
  const targetDirectory = await resolveMaterialDirectory(materialsRoot, materialType, materialName);
  if (!targetDirectory) {
    return undefined;
  }
  return resolveSingleMtlxFileInDirectory(targetDirectory);
}
