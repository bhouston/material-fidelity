export interface GenerateImageOptions {
  mtlxPath: string;
  outputPngPath: string;
  modelPath: string;
  environmentHdrPath: string;
  backgroundColor: string;
  screenWidth: number;
  screenHeight: number;
}

export interface FidelityAdapter {
  name: string;
  version: string;
  start: () => Promise<void>;
  shutdown: () => Promise<void>;
  generateImage: (options: GenerateImageOptions) => Promise<void>;
}

export interface AdapterModule {
  createAdapter: () => Promise<FidelityAdapter> | FidelityAdapter;
}

export interface LoadAdaptersOptions {
  adaptersRoot: string;
}

export interface CreateReferencesOptions {
  adaptersRoot: string;
  samplesRoot: string;
  adapterName: string;
  concurrency: number;
  backgroundColor: string;
  screenWidth: number;
  screenHeight: number;
}

export interface RenderFailure {
  materialPath: string;
  outputPngPath: string;
  error: Error;
}

export interface CreateReferencesResult {
  adapterName: string;
  rendered: number;
  failures: RenderFailure[];
}
