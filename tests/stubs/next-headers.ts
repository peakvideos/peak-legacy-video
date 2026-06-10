/**
 * Test stand-in for `next/headers` (aliased in vitest.config.ts). Server
 * actions read the incoming request's headers through this module; tests
 * provide them with `setTestRequestHeaders` — the server-action equivalent
 * of constructing a `Request` for a route handler.
 */

let current = new Headers();

export function setTestRequestHeaders(
  headersInit: Headers | Record<string, string>,
): void {
  current =
    headersInit instanceof Headers ? headersInit : new Headers(headersInit);
}

export function resetTestRequestHeaders(): void {
  current = new Headers();
}

export async function headers(): Promise<Headers> {
  return current;
}

export async function cookies(): Promise<never> {
  throw new Error("cookies() is not supported by the test request context.");
}
