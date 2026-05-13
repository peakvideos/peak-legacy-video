import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { db } from "./db";
import * as schema from "./db/schema";

const ownerEmails = (process.env.OWNER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Bootstrap toggle: set ALLOW_SIGNUP=true only long enough to create the
// owner account, then unset. With it off, Better Auth rejects the signup
// endpoint entirely. Sign-in keeps working for existing users.
const allowSignup = process.env.ALLOW_SIGNUP === "true";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    // Our tables are pluralized for Postgres convention; alias them to the
    // singular names the Better Auth adapter looks for.
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: !allowSignup,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
        defaultValue: "user",
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (ownerEmails.length === 0) {
            throw new APIError("FORBIDDEN", {
              message:
                "Sign-in is not configured. Set OWNER_EMAILS in the environment.",
            });
          }
          if (!ownerEmails.includes(user.email.trim().toLowerCase())) {
            throw new APIError("FORBIDDEN", {
              message: "This email is not authorized to access the dashboard.",
            });
          }
          return { data: user };
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
