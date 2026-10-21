export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId: string;
  versionId?: string;
}

const FIGMA_HOSTS = new Set(['figma.com', 'www.figma.com']);
const FIGMA_PATH_PATTERN = /^\/(?:design|file)\/([A-Za-z0-9_-]+)(?:\/.*)?$/;
const NODE_ID_PATTERN = /^(\d+)[-:](\d+)$/;
const VERSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Parses a Figma Design link into API parameters without retaining its URL or other query data. */
export function parseFigmaUrl(source: string): ParsedFigmaUrl {
  let url: URL;
  try {
    url = new URL(source.trim());
  } catch {
    throw new Error('invalid Figma URL');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Figma URL must use HTTPS');
  }
  if (!FIGMA_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Figma URL host must be figma.com or www.figma.com');
  }
  if (url.username !== '' || url.password !== '' || (url.port !== '' && url.port !== '443')) {
    throw new Error('Figma URL must not include credentials or a custom port');
  }

  const pathMatch = FIGMA_PATH_PATTERN.exec(url.pathname);
  if (pathMatch === null) {
    throw new Error('Figma URL path must be /design/:key or /file/:key');
  }

  const nodeIds = url.searchParams.getAll('node-id');
  if (nodeIds.length !== 1) {
    throw new Error('Figma URL must contain exactly one node-id parameter');
  }
  const nodeMatch = NODE_ID_PATTERN.exec(nodeIds[0]!);
  if (nodeMatch === null) {
    throw new Error('Figma URL node-id must use the form <number>-<number>');
  }

  const versionIds = url.searchParams.getAll('version-id');
  if (versionIds.length > 1) {
    throw new Error('Figma URL must contain at most one version-id parameter');
  }
  const versionId = versionIds[0];
  if (versionId !== undefined && !VERSION_ID_PATTERN.test(versionId)) {
    throw new Error('Figma URL version-id is invalid');
  }

  return {
    fileKey: pathMatch[1]!,
    nodeId: `${nodeMatch[1]}:${nodeMatch[2]}`,
    ...(versionId === undefined ? {} : { versionId }),
  };
}
