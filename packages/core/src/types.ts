export interface GenerateImageOptions {
  mtlxPath: string;
  outputPngPath: string;
  modelPath: string;
  environmentHdrPath: string;
  backgroundColor: string;
}

export interface RendererPrerequisiteCheckResult {
  success: boolean;
  message?: string;
}

export interface FidelityRenderer {
  name: string;
  version: string;
  checkPrerequisites: () => Promise<RendererPrerequisiteCheckResult> | RendererPrerequisiteCheckResult;
  start: () => Promise<void>;
  shutdown: () => Promise<void>;
  generateImage: (options: GenerateImageOptions) => Promise<void>;
}

export interface RendererContext {
  thirdPartyRoot: string;
}

export interface CreateReferencesOptions {
  thirdPartyRoot: string;
  renderers: FidelityRenderer[];
  rendererNames?: string[];
  materialSelectors?: string[];
  concurrency: number;
  filter?: string;
  shouldStop?: () => boolean;
  onPlan?: (event: CreateReferencesPlanEvent) => void | Promise<void>;
  onProgress?: (event: CreateReferencesProgressEvent) => void | Promise<void>;
}

export interface RenderFailure {
  rendererName: string;
  materialPath: string;
  outputPngPath: string;
  error: Error;
}

export interface CreateReferencesResult {
  rendererNames: string[];
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
  rendererName: string;
  materialPath: string;
  outputPngPath: string;
  total: number;
  started: number;
  completed: number;
  success?: boolean;
  durationMs?: number;
  error?: Error;
}
