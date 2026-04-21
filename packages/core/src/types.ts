export interface GenerateImageOptions {
  mtlxPath: string;
  outputPngPath: string;
  modelPath: string;
  environmentHdrPath: string;
  backgroundColor: string;
  screenWidth: number;
  screenHeight: number;
}

export interface AdapterPrerequisiteCheckResult {
  success: boolean;
  message?: string;
}

export interface FidelityAdapter {
  name: string;
  version: string;
  checkPrerequisites: () => Promise<AdapterPrerequisiteCheckResult> | AdapterPrerequisiteCheckResult;
  start: () => Promise<void>;
  shutdown: () => Promise<void>;
  generateImage: (options: GenerateImageOptions) => Promise<void>;
}

export interface AdapterContext {
  thirdPartyRoot: string;
}

export interface AdapterModule {
  createAdapter: (context?: AdapterContext) => Promise<FidelityAdapter> | FidelityAdapter;
}

export interface LoadAdaptersOptions {
  adaptersRoot: string;
  context?: AdapterContext;
}

export interface CreateReferencesOptions {
  adaptersRoot: string;
  thirdPartyRoot: string;
  adapterNames?: string[];
  materialSelectors?: string[];
  concurrency: number;
  screenWidth: number;
  screenHeight: number;
  filter?: string;
  shouldStop?: () => boolean;
  onPlan?: (event: CreateReferencesPlanEvent) => void | Promise<void>;
  onProgress?: (event: CreateReferencesProgressEvent) => void | Promise<void>;
}

export interface RenderFailure {
  adapterName: string;
  materialPath: string;
  outputPngPath: string;
  error: Error;
}

export interface CreateReferencesResult {
  adapterNames: string[];
  total: number;
  attempted: number;
  rendered: number;
  failures: RenderFailure[];
  stopped: boolean;
}

export interface CreateReferencesPlanEvent {
  materialPaths: string[];
}

export interface CreateReferencesProgressEvent {
  phase: 'start' | 'finish';
  adapterName: string;
  materialPath: string;
  outputPngPath: string;
  total: number;
  started: number;
  completed: number;
  success?: boolean;
  durationMs?: number;
  error?: Error;
}
