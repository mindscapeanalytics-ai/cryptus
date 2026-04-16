/**
 * RSIQ Pro - NOWPayments Crypto SDK
 * High-performance, lightweight fetch-based client for institutional crypto payments.
 */

const API_KEY = process.env.NOWPAYMENTS_API_KEY;
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET; // Ensure this is set in .env
const BASE_URL = 'https://api.nowpayments.io/v1';

export interface NOWPaymentsPlan {
  id: string;
  title: string;
  amount: number;
  currency: string;
  interval_day: number;
}

export interface NOWPaymentsSubscription {
  id: string;
  plan_id: string;
  status: string;
  invoice_url: string;
}

export class NOWPaymentsClient {
  static async request(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) {
    if (!API_KEY) throw new Error('NOWPAYMENTS_API_KEY is not configured');

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`NOWPayments API Error: ${error.message || res.statusText}`);
    }

    return res.json();
  }

  /**
   * Automatically creates or updates a recurring payment plan.
   */
  static async upsertPlan(title: string, amount: number, intervalDays: number): Promise<string> {
    const plans = await this.request('/subscriptions/plans', 'GET');
    const existing = plans.data?.find((p: any) => p.title === title && p.amount === amount);

    if (existing) return existing.id;

    const newPlan = await this.request('/subscriptions/plans', 'POST', {
      title,
      amount,
      currency: 'usd',
      interval_day: intervalDays,
    });

    return newPlan.id;
  }

  /**
   * Creates a hosted invoice for the Standard E-commerce Flow.
   * This is preferred for 2026 UX as it handles coin selection and QR codes.
   */
  static async createInvoice(orderId: string, amount: number, description: string): Promise<{ id: string; invoice_url: string }> {
    return this.request('/invoice', 'POST', {
      price_amount: amount,
      price_currency: 'usd',
      order_id: orderId,
      order_description: description,
      ipn_callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/nowpayments`,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/terminal?payment_status=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription?payment_status=cancelled`,
    });
  }

  /**
   * Retrieves the status of a specific payment.
   */
  static async getPaymentStatus(paymentId: string) {
    return this.request(`/payment/${paymentId}`, 'GET');
  }

  /**
   * Verifies the IPN signature to ensure the notification is authentic.
   */
  static verifyIPN(payload: any, signature: string): boolean {
    if (!API_KEY) return false;
    
    // In 2026, we prefer explicit signature verification using the Callback Secret
    // If IPN_SECRET is not provided, we fall back to a less secure check or rejection
    if (!IPN_SECRET) {
       console.warn('[nowpayments] IPN_SECRET missing. Verification skipped in development.');
       return process.env.NODE_ENV === 'development';
    }
    
    const crypto = require('crypto');
    // Important: NOWPayments requires the payload to be sorted alphabetically
    const sortedPayload = Object.keys(payload)
      .sort()
      .reduce((obj: any, key) => {
        obj[key] = payload[key];
        return obj;
      }, {});

    const hmac = crypto.createHmac('sha512', IPN_SECRET);
    const hash = hmac.update(JSON.stringify(sortedPayload)).digest('hex');

    return hash === signature;
  }
}
