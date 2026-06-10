import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Creates a throwaway database on the local Postgres server, runs the
 * drizzle migrations into it, and hands its URL to the workers via
 * `provide`. The database is dropped again on teardown.
 *
 * Connection settings come from TEST_DATABASE_URL, falling back to the
 * DATABASE_URL in .env.local — but only when it points at a local server,
 * so the suite can never touch a deployed database.
 */
export default async function setup(project: TestProject) {
  config({ path: ".env.local", quiet: true });
  config({ path: ".env", override: false, quiet: true });

  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "No TEST_DATABASE_URL or DATABASE_URL found. Tests need a local Postgres server to create a throwaway database on.",
    );
  }

  const baseUrl = new URL(base);
  if (!LOCAL_HOSTS.has(baseUrl.hostname)) {
    throw new Error(
      `Refusing to run tests against non-local database host "${baseUrl.hostname}". ` +
        "Set TEST_DATABASE_URL to a local Postgres server.",
    );
  }

  const dbName = `legacy_test_${randomBytes(6).toString("hex")}`;

  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);

  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${dbName}`;

  try {
    const client = postgres(testUrl.toString(), { max: 1 });
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.end();
  } catch (err) {
    await admin.unsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
    await admin.end();
    throw err;
  }

  project.provide("testDatabaseUrl", testUrl.toString());

  return async () => {
    await admin.unsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
    await admin.end();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}
