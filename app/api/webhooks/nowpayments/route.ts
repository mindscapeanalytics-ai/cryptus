import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NOWPaymentsClient } from "@/lib/nowpayments";

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-nowpayments-sig");
    if (!signature) {
      return NextResponse.json({ error: "No signature provided" }, { status: 400 });
    }

    const payload = await req.json();
    
    // 1. Verify Signature
    const isValid = NOWPaymentsClient.verifyIPN(payload, signature);
    if (!isValid) {
      console.warn("[nowpayments-webhook] Invalid signature detected.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    console.log("[nowpayments-webhook] Received IPN:", payload.payment_status, payload.subscription_id);

    // 2. Handle Payment Status
    // NOWPayments IPN for invoices returns 'payment_status' and 'invoice_id'
    const { payment_status, invoice_id, actually_paid, price_amount, status } = payload;
    
    // Status can sometimes be in 'status' field for legacy or 'payment_status'
    const finalStatus = payment_status || status;
    const currentInvoiceId = invoice_id || payload.payment_id;

    if (!currentInvoiceId) {
        return NextResponse.json({ error: "No invoice/payment ID in payload" }, { status: 400 });
    }

    // Find the pending subscription
    const sub = await prisma.subscription.findFirst({
      where: { nowpaymentsId: String(currentInvoiceId) }
    });

    if (!sub) {
      console.error(`[nowpayments-webhook] Subscription not found for ID: ${currentInvoiceId}`);
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // ── Business Logic: 2026 Best Practices ──
    let internalStatus = sub.status;
    let periodEnd = sub.periodEnd;

    // 1% Grace Margin for partial payments
    const expected = Number(price_amount || 0);
    const paid = Number(actually_paid || 0);
    const isCloseEnough = expected > 0 && paid >= (expected * 0.99);

    if (finalStatus === "finished" || (finalStatus === "partially_paid" && isCloseEnough)) {
      internalStatus = "active";
      const days = sub.billingInterval === "year" ? 365 : 30;
      periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else if (finalStatus === "failed" || finalStatus === "expired") {
      internalStatus = "canceled";
    } else if (finalStatus === "partially_paid" && !isCloseEnough) {
      internalStatus = "past_due";
    }

    // 3. Update Database
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: internalStatus,
        periodEnd,
        updatedAt: new Date(),
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[nowpayments-webhook] Error:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
