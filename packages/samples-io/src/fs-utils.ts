import { access } from 'node:fs/promises';

export async function pathExists(fileOrDirectoryPath: string): Promise<boolean> {
  try {
    await access(fileOrDirectoryPath);
    return true;
  } catch {
    return false;
  }
}
