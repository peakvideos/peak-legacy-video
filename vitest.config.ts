import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // The integration suite runs app code in plain Node. `server-only` is a
      // build-time guard with no runtime behavior worth testing; the Next
      // request-context modules are swapped for thin shims so server actions
      // can run as functions. The SMTP transport is the one true mock: tests
      // assert against the recording fake instead of Gmail.
      "server-only": path.join(root, "tests/stubs/server-only.ts"),
      nodemailer: path.join(root, "tests/stubs/nodemailer.ts"),
      "next/headers": path.join(root, "tests/stubs/next-headers.ts"),
      "next/cache": path.join(root, "tests/stubs/next-cache.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // All test files share one throwaway database; run them sequentially.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 60_000,
  },
});
