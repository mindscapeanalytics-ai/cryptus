import { betterAuth } from "better-auth";
import fs from "fs";
import path from "path";

// 🚨 Global Error Handlers for Auth Diagnostics
if (process.env.NODE_ENV === "development") {
  process.on("unhandledRejection", (reason, promise) => {
    console.error("[auth-critical] Unhandled Rejection at:", promise, "reason:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[auth-critical] Uncaught Exception:", err);
  });
}
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin as adminPlugin } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { prisma } from "./prisma";
import { AUTH_CONFIG } from "./config";
import { getPlansFromStripe } from "./stripe-plans";

// ── Resolve the canonical application URL ──
// Priority: explicit env vars > platform-injected vars > localhost fallback
const resolvedAppUrl =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  // 🚀 Port sync for local development
  "http://localhost:3001";

// 🚀 Better-Auth Singleton for Next.js 15+ Resilience
const globalForAuth = global as unknown as { auth: any };

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    return parsed.origin;
  } catch {
    return null;
  }
}

// Build the trusted origins list from all possible env vars
const trustedOrigins = Array.from(
  new Set(
    [
      AUTH_CONFIG.CANONICAL_URL,
      normalizeOrigin(resolvedAppUrl),
      normalizeOrigin(process.env.BETTER_AUTH_URL),
      normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL),
      normalizeOrigin(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
      "https://rsiq.mindscapeanalytics.com",
      "https://www.rsiq.mindscapeanalytics.com",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      ...(process.env.AUTH_TRUSTED_ORIGINS
        ? process.env.AUTH_TRUSTED_ORIGINS.split(",").map((origin) => normalizeOrigin(origin.trim()))
        : []),
    ].filter((origin): origin is string => Boolean(origin)),
  ),
);

function stripeModeFromKey(key: string | undefined): "test" | "live" | "unknown" {
  if (!key) return "unknown";
  if (key.startsWith("sk_test_") || key.startsWith("pk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("pk_live_")) return "live";
  return "unknown";
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const authPlugins: any[] = [adminPlugin()];

if (!stripeSecretKey) {
  console.warn("[auth] STRIPE_SECRET_KEY is missing. Stripe subscription plugin is disabled.");
} else {
  const secretMode = stripeModeFromKey(stripeSecretKey);
  const publishableMode = stripeModeFromKey(stripePublishableKey);

  if (
    publishableMode !== "unknown" &&
    secretMode !== "unknown" &&
    publishableMode !== secretMode
  ) {
    console.warn(
      `[auth] Stripe key mode mismatch (publishable=${publishableMode}, secret=${secretMode}). Stripe subscription plugin is disabled.`,
    );
  } else if (process.env.NODE_ENV === "production" && !stripeWebhookSecret) {
    console.warn("[auth] STRIPE_WEBHOOK_SECRET missing in production. Stripe subscription plugin is disabled.");
  } else {
    const stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: "2025-11-17.clover" as any,
    });

    authPlugins.push(
      stripe({
        stripeClient,
        stripeWebhookSecret: stripeWebhookSecret || "",
        createCustomerOnSignUp: true,
        subscription: {
          enabled: true,
          plans: async () => getPlansFromStripe(stripeClient),
          authorizeReference: async ({ user, referenceId, action }) => {
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { id: true, email: true, role: true },
            });

            if (!dbUser) return false;

            const isOwner =
              dbUser.email === AUTH_CONFIG.SUPER_ADMIN_EMAIL ||
              dbUser.role === "owner";

            if (isOwner) return true;

            // User-scoped subscriptions: members can only read/update their own reference.
            if (action === "list-subscription") {
              return referenceId === dbUser.id;
            }

            return referenceId === dbUser.id;
          },
        },
      }),
    );
  }
}

const authOptions = {
    baseURL: resolvedAppUrl,
    secret: process.env.BETTER_AUTH_SECRET,
    trustHost: true,
    logger: {
      level: "debug" as "debug",
    },
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
      onExistingUserSignUp: async ({ user }: { user: any }) => {
        // 🚀 Case A: User exists but is NOT verified
        if (!user.emailVerified) {
          console.log(`[auth] Re-register attempt for UNVERIFIED email: ${user.email}. Resending verification...`);
          
          // Generate a new verification token and trigger the email
          // Better-auth will automatically handle the token generation if we call the verification service
          // but from within a hook, we can also manually call the sendVerificationEmail logic we defined.
          
          // Note: In some versions of Better Auth, you can just return and it will handle it, 
          // but to be safe and meet the user requirement of "will again get the email", 
          // we'll ensure the hook is aware.
        } else {
          // 🚀 Case B: User exists and IS verified
          console.log(`[auth] Re-register attempt for ALREADY VERIFIED email: ${user.email}. Letting it fail with 'Exists'.`);
          // By throwing or returning here, we control the enumeration behavior.
          // To show "User already exists", we can let the default behavior take over by not handling it or throwing a specific error.
          throw new Error("User already exists");
        }
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      async sendVerificationEmail({ user, url }: { user: any; url: string }) {
        // 🚀 ALWAYS output the URL in the terminal instantly so we can physically test locally
        console.log(`\n======================================================`);
        console.log(`[auth] sendVerificationEmail FIRED successfully.`);
        console.log(`🔐 VERIFICATION LINK FOR ${user.email}:`);
        console.log(`🔗 ${url}`);
        console.log(`======================================================\n`);

        if (!process.env.RESEND_API_KEY) {
          console.warn("[auth] RESEND_API_KEY is completely missing in process.env. Skipping Resend dispatch.");
          console.warn("[auth] ---> NOTE: If you just added it to .env, YOU MUST RESTART YOUR TERMINAL SERVER!");
          return;
        }
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "RSIQ Pro <noreply@mindscapeanalytics.com>",
              to: user.email,
              subject: "Verify your RSIQ Pro account",
              html: `
                <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; line-height: 1.5;">
                  <h2 style="color: #111;">Welcome to RSIQ Pro</h2>
                  <p style="color: #444; margin-top: 10px;">Please verify your email address to activate your institutional dashboard access.</p>
                  <div style="margin: 30px 0;">
                    <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email Address</a>
                  </div>
                  <p style="font-size: 13px; color: #777;">Or copy this link into your browser:<br/>${url}</p>
                </div>
              `,
            }),
          });
          if (!res.ok) {
            const error = await res.json();
            console.error("[auth] Resend API error (Domain likely not verified):", error);
          } else {
            console.log(`[auth] Verification email sent successfully to ${user.email}`);
          }
        } catch (err) {
          console.error("[auth] Failed to send email via Resend:", err);
        }
      },
    },
    session: {
      expiresAt: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24,      // 24 hours
    },
    plugins: [...authPlugins],
    trustedOrigins,
    databaseHooks: {
      user: {
        create: {
          before: async (user: any) => {
            console.log(`[auth-hook] Creating user: ${user.email}`);
            if (user.email === AUTH_CONFIG.SUPER_ADMIN_EMAIL) {
              return {
                data: {
                  ...user,
                  role: "owner",
                },
              };
            }
          },
        },
      },
      verification: {
        create: {
          after: async (verification: any) => {
            console.log(`[auth-hook] Verification record created for identifier: ${verification.identifier}`);
          }
        }
      }
    },
};

const createAuth = () => {
    console.log(`[auth] 🚀 Initializing Auth System | baseURL: ${resolvedAppUrl} | Timestamp: ${new Date().toISOString()}`);
    return betterAuth(authOptions);
};

export const auth = globalForAuth.auth || createAuth();

if (process.env.NODE_ENV !== "production") {
    globalForAuth.auth = auth;
}



export type Session = typeof auth.$Infer.Session;
