/**
 * Build an absolute URL to an API endpoint.
 * In the Replit proxy environment, the API server is routed via the `/api` prefix.
 * The path parameter should be relative (e.g. "api/agent-status" → "/api/agent-status").
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return cleanPath;
}
