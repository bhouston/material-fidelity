export { createReferences } from './references.js';
export { calculateImageSimilarityMetrics, calculateMetrics } from './metrics.js';
export { REFERENCE_IMAGE_HEIGHT, REFERENCE_IMAGE_WIDTH } from './constants.js';
export type {
  RendererPrerequisiteCheckResult,
  RendererStartOptions,
  RendererContext,
  CreateReferencesPlanEvent,
  CreateReferencesOptions,
  CreateReferencesProgressEvent,
  CreateReferencesResult,
  FidelityRenderer,
  GenerateImageResult,
  GenerateImageOptions,
  RendererCategory,
  RenderLogEntry,
  RenderFailure,
} from './types.js';
export type {
  CalculateMetricsOptions,
  CalculateMetricsPlanEvent,
  CalculateMetricsProgressEvent,
  CalculateMetricsResult,
  ImageSimilarityMetrics,
  MaterialMetricsFile,
  MetricsFailure,
} from './metrics.js';
