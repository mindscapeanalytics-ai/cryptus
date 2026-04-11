import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSessionUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { AUTH_CONFIG } from "@/lib/config";
import { getPlansFromStripe } from "@/lib/stripe-plans";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

type CheckoutReason =
  | "ok"
  | "unauthorized"
  | "owner-bypass"
  | "trial-active"
  | "stripe-not-configured"
  | "plans-unavailable";

export async function GET() {
  const ctx = await getSessionUser();
  if (ctx.error) return ctx.error;

  const { session, user } = ctx;
  if (!session || !user) {
    return NextResponse.json(
      { canCheckout: false, reason: "unauthorized" satisfies CheckoutReason, message: "Please sign in first." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const isOwner = user.email === AUTH_CONFIG.SUPER_ADMIN_EMAIL || user.role === "owner";
  if (isOwner) {
    return NextResponse.json(
      {
        canCheckout: false,
        reason: "owner-bypass" satisfies CheckoutReason,
        message: "Owner account does not require checkout.",
      },
      { headers: NO_STORE_HEADERS },
    );
  }

  const trialMs = AUTH_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const createdAtMs = new Date(user.createdAt).getTime();
  const fallbackTrialEndMs = createdAtMs + trialMs;

  let trialActiveFromSubscription = false;
  try {
    const best = await prisma.subscription.findFirst({
      where: { referenceId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { status: true, trialEnd: true, periodEnd: true },
    });

    if (best?.status === "trialing") {
      const explicitTrialEndMs = best.trialEnd ? new Date(best.trialEnd).getTime() : null;
      const periodEndMs = best.periodEnd ? new Date(best.periodEnd).getTime() : null;
      const trialEndMs = explicitTrialEndMs ?? periodEndMs ?? fallbackTrialEndMs;
      trialActiveFromSubscription = !Number.isNaN(trialEndMs) && Date.now() < trialEndMs;
    }
  } catch (error: any) {
    if (error?.code !== "P2021") throw error;
  }

  const trialActiveByCreatedAt = Date.now() < fallbackTrialEndMs;
  const trialActive = trialActiveFromSubscription || trialActiveByCreatedAt;

  if (trialActive) {
    const daysLeft = Math.max(0, Math.ceil((fallbackTrialEndMs - Date.now()) / (1000 * 60 * 60 * 24)));
    return NextResponse.json(
      {
        canCheckout: false,
        reason: "trial-active" satisfies CheckoutReason,
        message: `Your trial is active${daysLeft > 0 ? ` for ${daysLeft} more day${daysLeft === 1 ? "" : "s"}` : ""}. Billing starts after trial.`,
      },
      { headers: NO_STORE_HEADERS },
    );
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!stripeSecretKey || !stripePublishableKey) {
    return NextResponse.json(
      {
        canCheckout: false,
        reason: "stripe-not-configured" satisfies CheckoutReason,
        message: "Billing is temporarily unavailable. Stripe is not configured.",
      },
      { headers: NO_STORE_HEADERS },
    );
  }

  try {
    const stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: "2025-11-17.clover" as any,
    });
    const plans = await getPlansFromStripe(stripeClient);
    const hasMonthly = plans.some((plan) => plan.name === "monthly" && !!plan.priceId);
    const hasYearly = plans.some((plan) => plan.name === "yearly" && !!plan.priceId);

    if (!hasMonthly || !hasYearly) {
      return NextResponse.json(
        {
          canCheckout: false,
          reason: "plans-unavailable" satisfies CheckoutReason,
          message: "Billing plans are not ready yet. Please retry in a minute.",
        },
        { headers: NO_STORE_HEADERS },
      );
    }
  } catch {
    return NextResponse.json(
      {
        canCheckout: false,
        reason: "plans-unavailable" satisfies CheckoutReason,
        message: "Unable to initialize billing plans right now. Please retry shortly.",
      },
      { headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      canCheckout: true,
      reason: "ok" satisfies CheckoutReason,
      message: "Checkout is ready.",
    },
    { headers: NO_STORE_HEADERS },
  );
}
