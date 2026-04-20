import { getLeadRecipients, sendEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Please enter a valid email address."),
    organization: z.string().min(1, "Organization is required."),
    service: z.string().min(1, "Please select a service."),
    message: z.string().min(10, "Message must be at least 10 characters."),
});

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

export async function POST(request: Request) {
    try {
        const clientIp = getClientIp(request.headers);
        const limit = checkRateLimit(`contact:${clientIp}`, 5, 60_000);

        if (!limit.allowed) {
            return NextResponse.json(
                { success: false, error: "Too many requests. Please try again shortly." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(limit.retryAfterSec),
                    },
                }
            );
        }

        const body = await request.json();
        const parsed = contactSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: parsed.error.issues[0]?.message || "Invalid request." },
                { status: 400 }
            );
        }

        const { name, email, organization, service, message } = parsed.data;
        const safe = {
            name: escapeHtml(name),
            email: escapeHtml(email),
            organization: escapeHtml(organization),
            service: escapeHtml(service),
            message: escapeHtml(message),
        };

        const { to, cc } = getLeadRecipients();

        const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a;">
        <h2 style="margin:0 0 12px;">New RSIQ Pro Support Inquiry</h2>
        <p style="margin:0 0 20px;color:#475569;">A user submitted the support contact form on the RSIQ Pro terminal.</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-weight:700;width:160px;">Name</td><td>${safe.name}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;">Email</td><td>${safe.email}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;">Organization</td><td>${safe.organization}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;">Service</td><td>${safe.service}</td></tr>
        </table>
        <div style="margin-top:20px;padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;white-space:pre-wrap;">${safe.message}</div>
      </div>
    `;

        const result = await sendEmail({
            to,
            cc,
            replyTo: email,
            subject: `[RSIQ_SUPPORT] ${organization} // ${service.toUpperCase()}`,
            html,
        });

        if (result.error) {
            return NextResponse.json(
                { success: false, error: "Failed to send inquiry email." },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[api/contact]", error);
        return NextResponse.json({ success: false, error: "Unexpected server error." }, { status: 500 });
    }
}
