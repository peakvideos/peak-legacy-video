// Test stand-in for `next/cache` (aliased in vitest.config.ts). There is no
// page cache in the test process, so revalidation is a no-op. The functions
// take no declared parameters — callers' arguments are simply discarded, and
// TypeScript checks call sites against the real next/cache types.

export function revalidatePath(): void {}

export function revalidateTag(): void {}
