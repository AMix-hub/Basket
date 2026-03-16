/**
 * SendGrid e-mail helper — server-side only.
 *
 * Required environment variables:
 *   SENDGRID_API_KEY   – API key from SendGrid Console → Settings → API Keys.
 *                        Must have "Mail Send" permission.
 *   SENDGRID_FROM      – Verified sender address (or domain), e.g. no-reply@sport-iq.se.
 *                        The address (or its domain) must be verified in SendGrid →
 *                        Settings → Sender Authentication.
 *
 * Usage:
 *   import { sendEmail } from "@/lib/sendgrid";
 *   await sendEmail({ to: "user@example.com", subject: "Hello", html: "<p>Hi!</p>" });
 */

import sgMail from "@sendgrid/mail";

export interface SendEmailOptions {
  /** One recipient address or an array of addresses. */
  to: string | string[];
  subject: string;
  html: string;
}

/**
 * Sends an e-mail via SendGrid.
 *
 * Throws if `SENDGRID_API_KEY` or `SENDGRID_FROM` are not set, or if the
 * SendGrid API returns an error.
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const apiKey  = process.env.SENDGRID_API_KEY  ?? "";
  const fromAddr = process.env.SENDGRID_FROM ?? "";

  if (!apiKey) {
    throw new Error(
      "SENDGRID_API_KEY is not configured. Set it in your environment variables."
    );
  }
  if (!fromAddr) {
    throw new Error(
      "SENDGRID_FROM is not configured. Set it to your verified sender address."
    );
  }

  sgMail.setApiKey(apiKey);
  await sgMail.send({ to, from: fromAddr, subject, html });
}
