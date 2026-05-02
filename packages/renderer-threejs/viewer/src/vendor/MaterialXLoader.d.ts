export class MaterialXLoader {
  archiveDisposer: (() => void) | null;
  constructor(manager?: unknown);
  setPath(path: string): this;
  load(
    url: string,
    onLoad: (result: unknown) => void,
    onProgress?: (event: unknown) => void,
    onError?: (error: unknown) => void,
    options?: MaterialXLoaderOptions,
  ): this;
  loadAsync(
    url: string,
    onProgressOrOptions?: ((event: unknown) => void) | MaterialXLoaderOptions,
    options?: MaterialXLoaderOptions,
  ): Promise<unknown>;
  parseBuffer(data: ArrayBuffer | Uint8Array | string, url?: string, options?: MaterialXLoaderOptions): unknown;
  parse(text: string, options?: MaterialXLoaderOptions): unknown;
  dispose(): this;
}

export interface MaterialXLoaderOptions {
  issuePolicy?: string;
  materialName?: string | null;
  onWarning?: ((issue: unknown) => void) | null;
  warningCallback?: ((issue: unknown) => void) | null;
  archiveResolver?: ((uri: string) => string | null) | null;
  path?: string;
}
