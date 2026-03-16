/**
 * Resend e-mail helper — server-side only.
 *
 * Required environment variables:
 *   RESEND_API_KEY   – API key from Resend Console → API Keys.
 *   RESEND_FROM      – Verified sender address (or domain), e.g. no-reply@sport-iq.se.
 *                      The address (or its domain) must be verified in Resend →
 *                      Domains.
 *
 * Usage:
 *   import { sendEmail } from "@/lib/email";
 *   await sendEmail({ to: "user@example.com", subject: "Hello", html: "<p>Hi!</p>" });
 */

import { Resend } from "resend";

export interface SendEmailOptions {
  /** One recipient address or an array of addresses. Both forms are accepted
   *  and normalized to an array before being passed to the Resend API. */
  to: string | string[];
  subject: string;
  html: string;
}

/**
 * Sends an e-mail via Resend.
 *
 * Throws if `RESEND_API_KEY` or `RESEND_FROM` are not set, or if the
 * Resend API returns an error.
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const apiKey   = process.env.RESEND_API_KEY ?? "";
  const fromAddr = process.env.RESEND_FROM ?? "";

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Set it in your environment variables."
    );
  }
  if (!fromAddr) {
    throw new Error(
      "RESEND_FROM is not configured. Set it to your verified sender address."
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromAddr,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
