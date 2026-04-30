/** Schema.org `WebSite` JSON-LD for the viewer home page. */
export function getViewerWebsiteJsonLd(siteUrl: string): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: import.meta.env.VITE_SITE_NAME,
    description: import.meta.env.VITE_SITE_DESCRIPTION,
    inLanguage: 'en',
  };

  const normalized = siteUrl.trim();
  if (normalized.length > 0) {
    data.url = normalized.endsWith('/') ? normalized : `${normalized}/`;
  }

  return data;
}
