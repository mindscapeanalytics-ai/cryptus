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

  const subscription = subscriptions.length > 0
    ? subscriptions.sort((a, b) => {
      const pa = statusPriority[a.status ?? ""] ?? 99;
      const pb = statusPriority[b.status ?? ""] ?? 99;
      return pa - pb;
    })[0]
    : null;

  if (subscription) {
    const isActive = subscription.status === "active";
    const isTrialing = subscription.status === "trialing";
    const isPastDue = subscription.status === "past_due";
    const now = Date.now();
    const trialMs = AUTH_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000;
    const createdAtMs = new Date(user.createdAt).getTime();

    const periodEndMs = subscription.periodEnd
      ? new Date(subscription.periodEnd).getTime()
      : null;

    const explicitTrialEndMs = subscription.trialEnd
      ? new Date(subscription.trialEnd).getTime()
      : null;

    const fallbackTrialEndMs = createdAtMs + trialMs;
    const trialEndMs = explicitTrialEndMs ?? periodEndMs ?? fallbackTrialEndMs;
    const trialActive = isTrialing && !Number.isNaN(trialEndMs) && now < trialEndMs;
    const daysLeft = trialActive
      ? Math.max(0, Math.ceil((trialEndMs - now) / (1000 * 60 * 60 * 24)))
      : 0;

    const activeAndExpired =
      isActive && !!periodEndMs && !Number.isNaN(periodEndMs) && periodEndMs < now;

    const graceMs = AUTH_CONFIG.PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    const withinPastDueGrace =
      isPastDue && !!periodEndMs && !Number.isNaN(periodEndMs) && now <= periodEndMs + graceMs;

    const hasActiveSubscription =
      (isActive && !activeAndExpired) || trialActive || withinPastDueGrace;

    // Check if there is a pending NOWPayments transaction
    const isProcessingPayment = subscriptions.some((s: any) => s.status === "waiting" && s.paymentProvider === "nowpayments");

    return NextResponse.json({
      hasActiveSubscription,
      subscription,
      isTrialing: trialActive,
      isProcessingPayment,
      daysLeft,
    }, { headers: NO_STORE_HEADERS });
  }

  // Check for processing even if no sub exists yet (e.g. first time buy)
  const isProcessingPayment = subscriptions.some((s: any) => s.status === "waiting" && s.paymentProvider === "nowpayments");

  const trialMs = AUTH_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const createdAt = new Date(user.createdAt).getTime();
  const now = Date.now();
  const trialActive = now < createdAt + trialMs;
  const daysLeft = trialActive
    ? Math.max(0, Math.ceil((createdAt + trialMs - now) / (1000 * 60 * 60 * 24)))
    : 0;

  return NextResponse.json({
    hasActiveSubscription: trialActive,
    subscription: null,
    isTrialing: trialActive,
    daysLeft,
  }, { headers: NO_STORE_HEADERS });
}
