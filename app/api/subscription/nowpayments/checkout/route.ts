import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";
import { NOWPaymentsClient } from "@/lib/nowpayments";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const ctx = await getSessionUser();
    if (ctx.error) return ctx.error;
    const { user } = ctx;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { plan } = await req.json();
    if (!['monthly', 'yearly'].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // ── Plan Configuration ──
    const amount = plan === 'monthly' ? 20 : 200;
    const description = `RSIQ Pro ${plan.charAt(0).toUpperCase() + plan.slice(1)} Access`;
    const orderId = `${user.id}_${Date.now()}_${plan}`;

    // 1. Create a hosted invoice (Standard E-commerce Flow)
    // This handles coins (SOL, USDT, USDC) automatically in the portal
    const invoice = await NOWPaymentsClient.createInvoice(orderId, amount, description);

    // 2. Store a robust pending record in the database
    // We use the invoice ID for tracking
    await prisma.subscription.create({
      data: {
        id: `np_${invoice.id}`,
        userId: user.id,
        referenceId: user.id,
        paymentProvider: "nowpayments",
        nowpaymentsId: invoice.id,
        nowpaymentsOrderId: orderId,
        status: "waiting", // Initial state
        plan,
        billingInterval: plan === 'monthly' ? 'month' : 'year',
      }
    });

    return NextResponse.json({ url: invoice.invoice_url });
  } catch (error: any) {
    console.error("[nowpayments-checkout] Error:", error.message);
    return NextResponse.json({ error: error.message || "Failed to initiate crypto payment" }, { status: 500 });
  }
}
