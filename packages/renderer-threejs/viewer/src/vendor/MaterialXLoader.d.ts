export interface MaterialXLogEntry {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  nodeName?: string;
}

export interface MaterialXLoaderResult {
  materials?: Record<string, unknown>;
  material?: unknown;
  log?: MaterialXLogEntry[];
  errors?: MaterialXLogEntry[];
  warnings?: MaterialXLogEntry[];
}

export class MaterialXLoader {
  archiveDisposer: (() => void) | null;
  constructor(manager?: unknown);
  setPath(path: string): this;
  load(
    url: string,
    onLoad: (result: MaterialXLoaderResult) => void,
    onProgress?: (event: unknown) => void,
    onError?: (error: unknown) => void,
    options?: MaterialXLoaderOptions,
  ): this;
  loadAsync(
    url: string,
    onProgressOrOptions?: ((event: unknown) => void) | MaterialXLoaderOptions,
    options?: MaterialXLoaderOptions,
  ): Promise<MaterialXLoaderResult>;
  parseBuffer(
    data: ArrayBuffer | Uint8Array | string,
    url?: string,
    options?: MaterialXLoaderOptions,
  ): MaterialXLoaderResult;
  parse(text: string, options?: MaterialXLoaderOptions): MaterialXLoaderResult;
  dispose(): this;
}

export interface MaterialXLoaderOptions {
  materialName?: string | null;
  uvSpace?: 'bottom-left' | 'top-left';
  archiveResolver?: ((uri: string) => string | null) | null;
  path?: string;
  throwOnErrors?: boolean;
  interfaceValidator?: ((rootNode: unknown, log: unknown) => void) | null;
}
