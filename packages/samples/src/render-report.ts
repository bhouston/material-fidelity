import { z } from 'zod';

export const RenderLogLevelSchema = z.enum(['debug', 'info', 'warning', 'error']);
export type RenderLogLevel = z.infer<typeof RenderLogLevelSchema>;

export const RenderLogSourceSchema = z.enum(['browser', 'renderer']);
export type RenderLogSource = z.infer<typeof RenderLogSourceSchema>;

export const RenderLogEntrySchema = z.object({
  level: RenderLogLevelSchema,
  source: RenderLogSourceSchema,
  message: z.string(),
});
export type RenderLogEntry = z.infer<typeof RenderLogEntrySchema>;

export const RenderReportIssueLevelSchema = z.enum(['error', 'warning']);
export type RenderReportIssueLevel = z.infer<typeof RenderReportIssueLevelSchema>;

export const RenderReportIssueSchema = z.object({
  level: RenderReportIssueLevelSchema,
  location: z.string(),
  message: z.string(),
});
export type RenderReportIssue = z.infer<typeof RenderReportIssueSchema>;

export const RenderReportErrorSchema = z.object({
  name: z.string(),
  message: z.string(),
  stack: z.string().optional(),
});
export type RenderReportError = z.infer<typeof RenderReportErrorSchema>;

export const RenderResultReportStatusSchema = z.enum(['success', 'failed']);
export type RenderResultReportStatus = z.infer<typeof RenderResultReportStatusSchema>;

export const RenderValidationReportStatusSchema = z.literal('validation_failed');
export type RenderValidationReportStatus = z.infer<typeof RenderValidationReportStatusSchema>;

export const RenderResultReportSchema = z.object({
  rendererName: z.string(),
  status: RenderResultReportStatusSchema,
  error: RenderReportErrorSchema.nullable(),
  validationIssues: z.array(RenderReportIssueSchema).optional(),
  logs: z.array(RenderLogEntrySchema).default([]),
});
export type RenderResultReport = z.infer<typeof RenderResultReportSchema>;

export const RenderValidationReportSchema = z.object({
  rendererName: z.string(),
  materialPath: z.string(),
  status: RenderValidationReportStatusSchema,
  issues: z.array(RenderReportIssueSchema),
});
export type RenderValidationReport = z.infer<typeof RenderValidationReportSchema>;

export const RenderReportSchema = z.discriminatedUnion('status', [
  RenderResultReportSchema,
  RenderValidationReportSchema,
]);
export type RenderReport = z.infer<typeof RenderReportSchema>;

export function parseRenderReport(value: unknown): RenderReport {
  return RenderReportSchema.parse(value);
}
