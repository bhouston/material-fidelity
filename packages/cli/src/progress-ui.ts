import { createElement } from 'react';
import { Box, Text } from 'ink';

export const MAX_PROGRESS_LOG_LINES = 20;

export type ProgressLogStatus = 'IN PROGRESS' | 'SUCCESS' | 'FAILED';

export interface ProgressLogLine {
  key: string;
  label: string;
  status: ProgressLogStatus;
  durationText?: string;
  errorMessage?: string;
}

export interface ProgressDisplayProps {
  title: string;
  statusLine: string;
  logs: ProgressLogLine[];
  completed: number;
  total: number;
  active: number;
  failed: number;
  elapsedText: string;
  etaText: string;
  footerTone?: 'gray' | 'yellow';
  footerSuffix?: string;
}

export function renderProgressBar(completed: number, total: number, width = 28): string {
  if (total <= 0) {
    return `[${' '.repeat(width)}] 0.0%`;
  }
  const ratio = Math.min(1, Math.max(0, completed / total));
  const filled = Math.round(ratio * width);
  return `[${'='.repeat(filled)}${'-'.repeat(Math.max(0, width - filled))}] ${(ratio * 100).toFixed(1)}%`;
}

export function appendProgressLogLine(
  previous: ProgressLogLine[],
  next: ProgressLogLine,
  maxLines = MAX_PROGRESS_LOG_LINES,
): ProgressLogLine[] {
  return [...previous, next].slice(-maxLines);
}

export function upsertProgressLogLine(
  previous: ProgressLogLine[],
  next: ProgressLogLine,
  maxLines = MAX_PROGRESS_LOG_LINES,
): ProgressLogLine[] {
  const existingIndex = previous.findIndex((entry) => entry.key === next.key);
  if (existingIndex === -1) {
    return appendProgressLogLine(previous, next, maxLines);
  }

  return previous.map((entry, index) => (index === existingIndex ? { ...entry, ...next } : entry));
}

function progressLogLineText(entry: ProgressLogLine): string {
  const durationPart = entry.durationText ? ` (${entry.durationText})` : '';
  const errorPart = entry.errorMessage ? ` - ${entry.errorMessage}` : '';
  return `${entry.label} | ${entry.status}${durationPart}${errorPart}`;
}

function progressLogLineColor(entry: ProgressLogLine): string {
  if (entry.status === 'SUCCESS') {
    return 'green';
  }
  if (entry.status === 'FAILED') {
    return 'red';
  }
  return 'white';
}

export function ProgressDisplay({
  title,
  statusLine,
  logs,
  completed,
  total,
  active,
  failed,
  elapsedText,
  etaText,
  footerTone = 'gray',
  footerSuffix,
}: ProgressDisplayProps) {
  const footer = `Elapsed: ${elapsedText} | ETA: ${etaText}${footerSuffix ? ` | ${footerSuffix}` : ''}`;

  return createElement(
    Box,
    { flexDirection: 'column' },
    createElement(Text, { color: 'cyan' }, title),
    createElement(Text, { color: 'gray' }, statusLine),
    createElement(Text, { color: 'white' }, ''),
    ...logs.map((entry) =>
      createElement(Text, { key: entry.key, color: progressLogLineColor(entry) }, progressLogLineText(entry)),
    ),
    createElement(Text, { color: 'white' }, ''),
    createElement(
      Text,
      undefined,
      `${renderProgressBar(completed, total)}  ${completed}/${total} complete, ${active} active, ${failed} failed`,
    ),
    createElement(Text, { color: footerTone }, footer),
  );
}
