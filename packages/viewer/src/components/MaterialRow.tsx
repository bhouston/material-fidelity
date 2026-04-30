import { DownloadIcon, ExternalLink, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MaterialViewModel, RendererCategoryGroupViewModel } from '#/lib/material-index';
import { getRendererMetadata } from '#/lib/renderer-metadata';
import { cn } from '#/lib/utils';

function toAnchorId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface MaterialRowProps {
  material: MaterialViewModel;
  rendererGroups: RendererCategoryGroupViewModel[];
  onTrackMaterialAction: (action: 'download_mtlx' | 'open_live_viewer', material: MaterialViewModel) => void;
  onOpenReport: (report: { materialName: string; rendererName: string; reportUrl: string }) => void;
}

function formatMetricValue(value: number | null | undefined, digits = 3): string {
  return value == null ? '-' : value.toFixed(digits);
}

type MetricSeverity = 'none' | 'warning' | 'error';

function getMetricSeverity(metricName: 'ssim' | 'psnr' | 'normalizedRgbRms' | 'vmaf', value: number | null): MetricSeverity {
  if (value === null) {
    return 'none';
  }

  switch (metricName) {
    case 'ssim':
      if (value <= 0.9) {
        return 'error';
      }
      if (value <= 0.95) {
        return 'warning';
      }
      return 'none';
    case 'psnr':
      if (value <= 20) {
        return 'error';
      }
      if (value <= 24) {
        return 'warning';
      }
      return 'none';
    case 'normalizedRgbRms':
      if (value >= 0.1) {
        return 'error';
      }
      if (value >= 0.07) {
        return 'warning';
      }
      return 'none';
    case 'vmaf':
      if (value <= 50) {
        return 'error';
      }
      if (value <= 70) {
        return 'warning';
      }
      return 'none';
  }
}

function getMetricValueClassName(severity: MetricSeverity): string {
  if (severity === 'error') {
    return 'rounded-sm bg-red-100 px-1 text-red-950 dark:bg-red-950/50 dark:text-red-100';
  }

  if (severity === 'warning') {
    return 'rounded-sm bg-orange-100 px-1 text-orange-950 dark:bg-orange-950/50 dark:text-orange-100';
  }

  return 'text-foreground';
}

function RendererMetrics({ metrics }: { metrics: MaterialViewModel['metrics'][string] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] leading-4 text-muted-foreground">
      <div className="flex justify-between gap-1">
        <dt>SSIM</dt>
        <dd className={cn('font-mono', getMetricValueClassName(getMetricSeverity('ssim', metrics?.ssim ?? null)))}>
          {formatMetricValue(metrics?.ssim)}
        </dd>
      </div>
      <div className="flex justify-between gap-1">
        <dt>PSNR</dt>
        <dd className={cn('font-mono', getMetricValueClassName(getMetricSeverity('psnr', metrics?.psnr ?? null)))}>
          {formatMetricValue(metrics?.psnr, 1)}
        </dd>
      </div>
      <div className="flex justify-between gap-1">
        <dt>RMS</dt>
        <dd
          className={cn(
            'font-mono',
            getMetricValueClassName(getMetricSeverity('normalizedRgbRms', metrics?.normalizedRgbRms ?? null)),
          )}
        >
          {formatMetricValue(metrics?.normalizedRgbRms)}
        </dd>
      </div>
      <div className="flex justify-between gap-1">
        <dt>VMAF</dt>
        <dd className={cn('font-mono', getMetricValueClassName(getMetricSeverity('vmaf', metrics?.vmaf ?? null)))}>
          {formatMetricValue(metrics?.vmaf, 1)}
        </dd>
      </div>
    </dl>
  );
}

function getReportButtonClassName(summary: MaterialViewModel['reportSummaries'][string]): string {
  if (summary?.severity === 'error') {
    return 'border-red-600 bg-red-600 text-white hover:bg-red-700 dark:border-red-500 dark:bg-red-600 dark:text-white dark:hover:bg-red-700';
  }

  if (summary?.severity === 'warning') {
    return 'border-orange-400 bg-orange-400 text-black hover:bg-orange-500 dark:border-orange-400 dark:bg-orange-400 dark:text-black dark:hover:bg-orange-500';
  }

  return 'border-border bg-background/85 text-foreground hover:bg-background';
}

export function MaterialRow({ material, rendererGroups, onTrackMaterialAction, onOpenReport }: MaterialRowProps) {
  const materialId = toAnchorId(material.id);
  const rowContentRef = useRef<HTMLDivElement | null>(null);
  const [shouldRenderContent, setShouldRenderContent] = useState(false);

  useEffect(() => {
    const rowContent = rowContentRef.current;
    if (!rowContent || shouldRenderContent) {
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setShouldRenderContent(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRenderContent(true);
          observer.disconnect();
        }
      },
      { rootMargin: '900px 0px' },
    );
    observer.observe(rowContent);
    return () => {
      observer.disconnect();
    };
  }, [shouldRenderContent]);

  return (
    <article className="border-b border-border py-4 last:border-b-0">
      <div className="group flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={materialId} className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span>{material.displayPath}</span>
          <a
            aria-label={`Link to ${material.displayPath}`}
            className="text-sm text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            href={`#${materialId}`}
          >
            #
          </a>
        </h3>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2 text-sm">
          <a
            className="inline-flex items-center gap-1 rounded-none border border-border bg-muted/40 px-2.5 py-1.5 font-normal text-foreground transition-colors hover:border-primary/40 hover:bg-muted/60"
            download
            href={material.downloadMtlxZipUrl}
            onClick={() => onTrackMaterialAction('download_mtlx', material)}
          >
            <DownloadIcon className="size-3.5" />
            <span>Download</span>
          </a>
          <a
            className="inline-flex items-center gap-1 rounded-none border border-border bg-muted/40 px-2.5 py-1.5 font-normal text-foreground transition-colors hover:border-primary/40 hover:bg-muted/60"
            href={material.liveViewerUrl}
            onClick={() => onTrackMaterialAction('open_live_viewer', material)}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" /> <span>Viewer</span>
          </a>
        </div>
      </div>

      <div className="mt-3 -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6" ref={rowContentRef}>
        <div className="flex w-max min-w-full justify-start gap-4 lg:justify-center">
          {rendererGroups.map((rendererGroup, groupIndex) => (
            <div key={rendererGroup.category} className="flex flex-none items-stretch gap-4">
              {rendererGroup.renderers.map((rendererName) => {
                if (!shouldRenderContent) {
                  return (
                    <figure key={rendererName} className="flex w-[170px] flex-none flex-col gap-2 sm:w-[200px]">
                      <div className="flex aspect-square w-full items-center justify-center border border-dashed border-border bg-muted/20 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        not loaded
                      </div>
                      <figcaption className="text-center text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">{rendererName}</p>
                      </figcaption>
                    </figure>
                  );
                }

                const imageUrl = material.images[rendererName];
                const reportUrl = material.reports[rendererName];
                const reportSummary = material.reportSummaries[rendererName] ?? null;
                const metrics = material.metrics[rendererName] ?? null;
                const metadata = getRendererMetadata(rendererName);
                return (
                  <figure key={rendererName} className="flex w-[170px] flex-none flex-col gap-2 sm:w-[200px]">
                    <div className="relative">
                      {imageUrl ? (
                        <img
                          alt={`${material.name} rendered by ${rendererName}`}
                          className="aspect-square w-full border border-border object-cover"
                          loading="lazy"
                          src={imageUrl}
                        />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center border border-dashed border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          missing
                        </div>
                      )}
                      {reportUrl ? (
                        <button
                          aria-label={`Show render report for ${material.name} on ${rendererName}`}
                          className={cn(
                            'absolute right-2 bottom-2 inline-flex size-7 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition-colors',
                            getReportButtonClassName(reportSummary),
                          )}
                          onClick={() => onOpenReport({ materialName: material.name, rendererName, reportUrl })}
                          type="button"
                        >
                          <Info className="size-4" />
                        </button>
                      ) : null}
                    </div>
                    <RendererMetrics metrics={metrics} />
                    <figcaption className="text-center text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{rendererName}</p>
                      <p>{metadata?.description ?? 'Renderer description unavailable.'}</p>
                    </figcaption>
                  </figure>
                );
              })}
              {groupIndex < rendererGroups.length - 1 ? (
                <div aria-hidden="true" className="my-1 w-px self-stretch bg-border" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
