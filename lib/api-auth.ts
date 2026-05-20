import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUTH_CONFIG } from "@/lib/config";

type SubscriptionStatusRef = {
  status: string | null;
  endedAt: Date | null;
  periodEnd: Date | null;
  trialEnd: Date | null;
  updatedAt?: Date | null;
};

export async function getSessionUser() {
  const activeHeaders = await headers();
  
  // ─── Phase 3: Fast-Path Identity Retrieval (Zero-Lag) ───
  // If the request passed through middleware protection, we consume the 
  // trusted headers to skip redundant DB/Session fetches.
  const trustedId = activeHeaders.get("x-rsiq-user-id");
  const trustedRole = activeHeaders.get("x-rsiq-user-role");
  
  if (trustedId) {
    // Return a synthetic session/user object from trusted headers.
    // NOTE: This assumes the middleware has already done the heavy validation.
    return {
      session: { user: { id: trustedId, email: "trusted@rsiq.pro" } } as any,
      user: { id: trustedId, role: trustedRole || "user", email: "trusted@rsiq.pro" } as any,
      error: null,
      isFastPath: true
    };
  }

  // Fallback to full DB validation for any routes that bypass middleware (e.g. CLI/External)
  const session = await auth.api.getSession({ headers: activeHeaders });
  if (!session) {
    return { session: null, user: null, error: unauthorized() };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  if (!user) {
    return { session: null, user: null, error: unauthorized() };
  }

  return { session, user, error: null };
}

export async function requireOwner() {
  const ctx = await getSessionUser();
  if (ctx.error) return ctx;

  const isOwner =
    ctx.user?.email === AUTH_CONFIG.SUPER_ADMIN_EMAIL ||
    ctx.user?.role === "owner";

  if (!isOwner) {
    return { ...ctx, error: forbidden() };
  }

  return ctx;
}

export async function checkSubscription(
  session: { user: { email: string; id: string } },
  referenceId: string,
) {
  if (session.user.email === AUTH_CONFIG.SUPER_ADMIN_EMAIL) {
    return { ok: true };
  }

  const subs = await prisma.subscription.findMany({
    where: { referenceId },
    orderBy: { updatedAt: "desc" },
    select: { status: true, endedAt: true, periodEnd: true, trialEnd: true, updatedAt: true },
  }) as SubscriptionStatusRef[];

  const user = await prisma.user.findUnique({
    where: { id: referenceId },
    select: { createdAt: true },
  });

  const statusPriority: Record<string, number> = { active: 0, trialing: 1, past_due: 2 };
  const now = Date.now();
  const trialMs = AUTH_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const fallbackTrialEndMs = user ? user.createdAt.getTime() + trialMs : null;
  const graceMs = AUTH_CONFIG.PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;

  const evaluateSub = (sub: SubscriptionStatusRef) => {
    const periodEndMs = sub.periodEnd ? new Date(sub.periodEnd).getTime() : null;
    const explicitTrialEndMs = sub.trialEnd ? new Date(sub.trialEnd).getTime() : null;
    const trialEndMs = explicitTrialEndMs ?? periodEndMs ?? fallbackTrialEndMs;
    const isActive = sub.status === "active";
    const isTrialing = sub.status === "trialing";
    const isPastDue = sub.status === "past_due";
    const activeAndExpired = isActive && !!periodEndMs && !Number.isNaN(periodEndMs) && periodEndMs < now;
    const withinPastDueGrace =
      isPastDue && !!periodEndMs && !Number.isNaN(periodEndMs) && now <= periodEndMs + graceMs;
    const trialActive = isTrialing && !!trialEndMs && !Number.isNaN(trialEndMs) && now < trialEndMs;
    const valid = (isActive && !activeAndExpired) || trialActive || withinPastDueGrace;
    return {
      sub,
      valid,
      priority: statusPriority[sub.status ?? ""] ?? 99,
      endMs: trialEndMs ?? 0,
      updatedAtMs: sub.updatedAt ? new Date(sub.updatedAt).getTime() : 0,
    };
  };

  const validSubscriptions = subs
    .map(evaluateSub)
    .filter((entry) => entry.valid)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.endMs !== b.endMs) return b.endMs - a.endMs;
      return b.updatedAtMs - a.updatedAtMs;
    });

  const subscription = validSubscriptions.length > 0
    ? validSubscriptions[0].sub
    : subs.length > 0
      ? subs[0]
      : null;

  if (subscription) {
    const isActive = subscription.status === "active";
    const isTrialing = subscription.status === "trialing";
    const isPastDue = subscription.status === "past_due";

    const now = Date.now();
    const hasEnded = subscription.endedAt && subscription.endedAt.getTime() < now;
    const periodEndMs = subscription.periodEnd ? new Date(subscription.periodEnd).getTime() : null;
    const explicitTrialEndMs = subscription.trialEnd ? new Date(subscription.trialEnd).getTime() : null;
    const fallbackTrialEndMs = user
      ? user.createdAt.getTime() + AUTH_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000
      : null;
    const trialEndMs = explicitTrialEndMs ?? periodEndMs ?? fallbackTrialEndMs;
    const graceMs = AUTH_CONFIG.PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;

    const activeButExpired =
      isActive && !!periodEndMs && !Number.isNaN(periodEndMs) && periodEndMs < now;

    const withinPastDueGrace =
      isPastDue && !!periodEndMs && !Number.isNaN(periodEndMs) && now <= periodEndMs + graceMs;

    const withinTrialWindow =
      isTrialing && !!trialEndMs && !Number.isNaN(trialEndMs) && now < trialEndMs;

    if (((isActive && !activeButExpired) || withinTrialWindow || withinPastDueGrace) && !hasEnded) {
      return { ok: true, subscription };
    }
  }

  if (user) {
    const createdAt = user.createdAt.getTime();
    const trialMs = AUTH_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() < createdAt + trialMs) {
      return { ok: true, subscription: { status: "trialing", virtual: true } };
    }
  }

  return {
    ok: false,
    error: NextResponse.json(
      {
        error: subscription
          ? `Your subscription status is ${subscription.status}. Please update billing information.`
          : "No active subscription found. Please subscribe to continue.",
      },
      { status: 402 },
    ),
  };
}

export function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized", statusCode: 401 }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ success: false, error: "Forbidden", statusCode: 403 }, { status: 403 });
}
