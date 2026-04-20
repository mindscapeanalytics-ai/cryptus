import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "RSIQ Pro <noreply@mindscapeanalytics.com>";
const LEAD_TO = process.env.LEAD_NOTIFICATION_TO || "contact@mindscapeanalytics.com";
const LEAD_CC = process.env.LEAD_NOTIFICATION_CC || "info@mindscapeanalytics.com";

let resendInstance: Resend | null = null;

function getResend(): Resend {
    if (!RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is not configured.");
    }

    if (!resendInstance) {
        resendInstance = new Resend(RESEND_API_KEY);
    }

    return resendInstance;
}

export function getLeadRecipients() {
    const to = LEAD_TO.split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    const cc = LEAD_CC.split(",")
        .map((v) => v.trim())
        .filter(Boolean);

    return { to, cc };
}

export async function sendEmail(params: {
    to: string[];
    cc?: string[];
    subject: string;
    html: string;
    replyTo?: string;
}) {
    const resend = getResend();
    const result = await resend.emails.send({
        from: EMAIL_FROM,
        to: params.to,
        cc: params.cc,
        subject: params.subject,
        html: params.html,
        replyTo: params.replyTo,
    });

    return result;
}
