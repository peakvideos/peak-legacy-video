// Test stand-in for `next/cache` (aliased in vitest.config.ts). There is no
// page cache in the test process, so revalidation is a no-op.

export function revalidatePath(_path: string, _type?: "page" | "layout"): void {}

export function revalidateTag(_tag: string): void {}
