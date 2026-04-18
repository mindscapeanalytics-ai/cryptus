import { betterAuth } from "better-auth";
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
  (typeof window !== "undefined" ? window.location.origin : null) ||
  "http://localhost:3000";

if (process.env.NODE_ENV === "development") {
  console.log(`[auth] 🚀 Initializing Auth System | baseURL: ${resolvedAppUrl} | Timestamp: ${new Date().toISOString()}`);
}

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
      "http://127.0.0.1:3000",
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

export const auth = betterAuth({
  baseURL: resolvedAppUrl,
  secret: process.env.BETTER_AUTH_SECRET,

  // Required when running behind a reverse proxy (Render, Vercel, Cloudflare, etc.)
  // Without this, Better Auth rejects requests because the Host header doesn't match.
  trustHost: true,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    autoSignIn: false,
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url, token }) {
      if (!process.env.RESEND_API_KEY) {
        console.warn("[auth] RESEND_API_KEY is missing. Skipping verification email.");
        return;
      }
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rsiq.mindscapeanalytics.com";
        const callbackParam = encodeURIComponent(`${appUrl}/login?verified=true`);
        
        // Ensure the verification URL includes our explicit callback to trigger the UI banner
        const finalUrl = url.includes("callbackURL") 
          ? url.replace(/callbackURL=[^&]+/, `callbackURL=${callbackParam}`)
          : `${url}${url.includes('?') ? '&' : '?'}callbackURL=${callbackParam}`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "RSIQ Pro <zeeshan.keerio@mindscapeanalytics.com>",
            to: user.email,
            subject: "Verify your email - RSIQ Pro",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #05080F; color: white; padding: 40px; border-radius: 12px; border: 1px solid #1c2330;">
                <h1 style="color: #39FF14; text-align: center; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 2px;">RSIQ Pro</h1>
                <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px; color: #cbd5e1;">Welcome to RSIQ Pro. To activate your Global Terminal and start scanning the markets, please verify your email address.</p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${finalUrl}" style="background-color: #39FF14; color: black; padding: 16px 32px; font-weight: bold; text-decoration: none; border-radius: 8px; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">Verify Email</a>
                </div>
                <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 40px;">If you didn't create this account, you can safely ignore this email.</p>
              </div>
            `,
          }),
        });
      } catch (err) {
        console.error("[auth] Failed to send verification email:", err);
      }
    },
  },

  email: {
    async sendEmail({ to, subject, body }: { to: string; subject: string; body: string }) {
      if (!process.env.RESEND_API_KEY) {
        console.warn("[auth] RESEND_API_KEY is missing. Skipping email delivery.");
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
            from: "RSIQ Pro <zeeshan.keerio@mindscapeanalytics.com>",
            to,
            subject,
            html: body,
          }),
        });
        if (!res.ok) {
          const error = await res.json();
          console.error("[auth] Resend API error:", error);
        }
      } catch (err) {
        console.error("[auth] Failed to send email via Resend:", err);
      }
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // refresh daily
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
    },
  },

  // ── 2026 Production Readiness Guard ────────────────────────
  plugins: [
    ...authPlugins,
    {
      id: "prod-guard",
      hooks: {
        before: [
          {
            matcher: () => true,
            handler: async () => {
              if (process.env.NODE_ENV === "production") {
                const MISSING = [];
                if (!process.env.BETTER_AUTH_SECRET) MISSING.push("BETTER_AUTH_SECRET");
                if (!process.env.STRIPE_SECRET_KEY) MISSING.push("STRIPE_SECRET_KEY");
                if (!process.env.RESEND_API_KEY) MISSING.push("RESEND_API_KEY");
                
                if (MISSING.length > 0) {
                  console.error(`
┌──────────────────────────────────────────────────────────────────┐
│  ⚠️  SYSTEM INCOMPLETE (PRODUCTION MODE)                          │
├──────────────────────────────────────────────────────────────────┤
│ Missing Critical Secrets: ${MISSING.join(", ")}
│ The institutional terminal may experience failures.              │
└──────────────────────────────────────────────────────────────────┘
                  `);
                } else {
                  console.log("── RSIQ Pro: Institutional Auth System READY ──");
                }
              }
            }
          }
        ]
      }
    }
  ],

  trustedOrigins,
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
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
  },
});

export type Session = typeof auth.$Infer.Session;
