import { describe, expect, it } from 'vitest';
import { MaterialXLog, MaterialXLogCodes, MaterialXLoader } from './index.js';

describe('renderer-threejs loader entrypoint', () => {
  it('exports MaterialXLoader and MaterialXLog helpers', () => {
    expect(typeof MaterialXLoader).toBe('function');
    expect(MaterialXLogCodes.UNSUPPORTED_NODE.label).toBe('unsupported-node');
    expect(MaterialXLogCodes.UNSUPPORTED_NODE.severity).toBe('error');

    const log = new MaterialXLog();
    log.add(MaterialXLogCodes.INVALID_VALUE, 'bad value', 'nodeA');
    expect(log.errors).toEqual([{ code: 'invalid-value', severity: 'error', message: 'bad value', nodeName: 'nodeA' }]);
  });
});
