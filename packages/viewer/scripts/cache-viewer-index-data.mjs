import { writeViewerIndexDataCache } from '../src/lib/material-index.ts';

const cachePath = await writeViewerIndexDataCache();
console.log(`Wrote viewer index data cache to ${cachePath}`);
