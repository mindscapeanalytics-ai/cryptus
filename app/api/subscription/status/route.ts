import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { AUTH_CONFIG } from "@/lib/config";

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

export async function GET() {
  const ctx = await getSessionUser();
  if (ctx.error) return ctx.error;

  const { session, user } = ctx;
  if (!session || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperAdmin = user.email === AUTH_CONFIG.SUPER_ADMIN_EMAIL || user.role === "owner";

  if (isSuperAdmin) {
    return NextResponse.json({
      hasActiveSubscription: true,
      isSuperAdmin: true,
      subscription: null,
    }, { headers: NO_STORE_HEADERS });
  }

  let subscriptions: Array<{
    id: string;
    referenceId: string;
    status: string;
    plan: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    trialEnd: Date | null;
    stripeSubscriptionId: string | null;
    invoiceRef: string | null;
    renewalNotes: string | null;
  }> = [];

  try {
    subscriptions = await prisma.subscription.findMany({
      where: { referenceId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        referenceId: true,
        status: true,
        plan: true,
        periodStart: true,
        periodEnd: true,
        trialEnd: true,
        endedAt: true,
        stripeSubscriptionId: true,
        paymentProvider: true,
        invoiceRef: true,
        renewalNotes: true,
        updatedAt: true,
      },
    });
  } catch (error: any) {
    if (error?.code !== "P2021") throw error;
    subscriptions = [];
  }

  const statusPriority: Record<string, number> = {
    active: 0,
    trialing: 1,
    past_due: 2,
  };

  const now = Date.now();
  const createdAtMs = new Date(user.createdAt).getTime();
  const trialMs = AUTH_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const fallbackTrialEndMs = createdAtMs + trialMs;
  const graceMs = AUTH_CONFIG.PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;

  const evaluateSubscription = (sub: typeof subscriptions[number]) => {
    const periodEndMs = sub.periodEnd ? new Date(sub.periodEnd).getTime() : null;
    const explicitTrialEndMs = sub.trialEnd ? new Date(sub.trialEnd).getTime() : null;
    const trialEndMs = explicitTrialEndMs ?? periodEndMs ?? fallbackTrialEndMs;
    const isActive = sub.status === "active";
    const isTrialing = sub.status === "trialing";
    const isPastDue = sub.status === "past_due";
    const activeAndExpired = isActive && !!periodEndMs && !Number.isNaN(periodEndMs) && periodEndMs < now;
    const withinPastDueGrace =
      isPastDue && !!periodEndMs && !Number.isNaN(periodEndMs) && now <= periodEndMs + graceMs;
    const trialActive = isTrialing && !Number.isNaN(trialEndMs) && now < trialEndMs;
    const isValid = (isActive && !activeAndExpired) || trialActive || withinPastDueGrace;

    return {
      sub,
      isValid,
      priority: statusPriority[sub.status ?? ""] ?? 99,
      endMs: trialEndMs ?? 0,
      updatedAtMs: sub.updatedAt ? new Date(sub.updatedAt).getTime() : 0,
      trialActive,
      isProcessingPayment: sub.status === "waiting" && sub.paymentProvider === "nowpayments",
    };
  };

  const validSubscriptions = subscriptions
    .map(evaluateSubscription)
    .filter((entry) => entry.isValid)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.endMs !== b.endMs) return b.endMs - a.endMs;
      return b.updatedAtMs - a.updatedAtMs;
    });

  const subscription = validSubscriptions.length > 0
    ? validSubscriptions[0].sub
    : null;

  const isProcessingPayment = subscriptions.some((s) => s.status === "waiting" && s.paymentProvider === "nowpayments");

  if (subscription) {
    const periodEndMs = subscription.periodEnd
      ? new Date(subscription.periodEnd).getTime()
      : null;

    const explicitTrialEndMs = subscription.trialEnd
      ? new Date(subscription.trialEnd).getTime()
      : null;

    const trialEndMs = explicitTrialEndMs ?? periodEndMs ?? fallbackTrialEndMs;
    const isActive = subscription.status === "active";
    const isTrialing = subscription.status === "trialing";
    const isPastDue = subscription.status === "past_due";
    const activeAndExpired =
      isActive && !!periodEndMs && !Number.isNaN(periodEndMs) && periodEndMs < now;
    const withinPastDueGrace =
      isPastDue && !!periodEndMs && !Number.isNaN(periodEndMs) && now <= periodEndMs + graceMs;
    const trialActive = isTrialing && !Number.isNaN(trialEndMs) && now < trialEndMs;
    const daysLeft = trialActive
      ? Math.max(0, Math.ceil((trialEndMs - now) / (1000 * 60 * 60 * 24)))
      : 0;

    const hasActiveSubscription =
      (isActive && !activeAndExpired) || trialActive || withinPastDueGrace;

    return NextResponse.json({
      hasActiveSubscription,
      subscription,
      isTrialing: trialActive,
      isProcessingPayment,
      daysLeft,
    }, { headers: NO_STORE_HEADERS });
  }

  const trialActive = now < fallbackTrialEndMs;
  const daysLeft = trialActive
    ? Math.max(0, Math.ceil((fallbackTrialEndMs - now) / (1000 * 60 * 60 * 24)))
    : 0;

  return NextResponse.json({
    hasActiveSubscription: trialActive,
    subscription: null,
    isTrialing: trialActive,
    isProcessingPayment,
    daysLeft,
  }, { headers: NO_STORE_HEADERS });
}
