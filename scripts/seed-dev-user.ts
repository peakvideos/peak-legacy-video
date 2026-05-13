/**
 * Creates the owner account for the `/admin` dashboard.
 *
 * Requires:
 *   - The email is listed in OWNER_EMAILS (allowlist hook in lib/auth.ts).
 *   - ALLOW_SIGNUP=true is set, otherwise Better Auth rejects the signup call.
 *
 * After the row is created, manually mark it as admin in Postgres:
 *   UPDATE users SET role='admin' WHERE email='<owner email>';
 *
 * Run: `pnpm db:seed`  (loads .env.local automatically)
 */

import { auth } from "../lib/auth";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const email = "eppler97@gmail.com";
const password = process.env.DEV_USER_PASSWORD || "devpass1234";
const name = process.env.DEV_USER_NAME || "Dev User";

async function main() {
  if (!email) {
    console.error(
      "No email to seed. Set DEV_USER_EMAIL or ensure OWNER_EMAILS is non-empty.",
    );
    process.exit(1);
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`User ${email} already exists. Skipping create.`);
    console.log(`To reset, delete the row first: DELETE FROM users WHERE email='${email}';`);
    process.exit(0);
  }

  try {
    await auth.api.signUpEmail({ body: { email, password, name } });
    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.email, email));

    console.log("✅ Created owner user.");
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}`);
    console.log(
      `\nNext: promote to admin in Postgres, then unset ALLOW_SIGNUP:`,
    );
    console.log(`   UPDATE users SET role='admin' WHERE email='${email}';`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Failed to create owner user:", msg);
    if (msg.toLowerCase().includes("forbidden") || msg.includes("not authorized")) {
      console.error(
        `\nThe email is not allowlisted. Add it to OWNER_EMAILS first.`,
      );
    }
    if (msg.toLowerCase().includes("sign") && msg.toLowerCase().includes("disabled")) {
      console.error(
        `\nSignup is disabled. Set ALLOW_SIGNUP=true to bootstrap, then unset.`,
      );
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
