/**
 * POST /api/notify
 *
 * Sends a cancellation notification email to all members of a team.
 * (Push notifications via FCM removed; email via Resend/SendGrid is sufficient.)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmail } from "../../../lib/email";

export async function POST(req: NextRequest) {
  let body: {
    teamId?: string;
    sessionTitle?: string;
    sessionDate?: string;
    sessionTime?: string;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { teamId, sessionTitle, sessionDate, sessionTime, reason } = body;
  if (!teamId || !sessionTitle || !sessionDate || !sessionTime || !reason) {
    return NextResponse.json({ error: "teamId, sessionTitle, sessionDate, sessionTime, reason are required" }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured (SUPABASE_SERVICE_ROLE_KEY missing)" }, { status: 500 });
  }

  // Verify caller
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { error: authErr } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (authErr) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch team members
  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId);

  if (!members || members.length === 0) {
    return NextResponse.json({ sent: 0, emailed: 0 });
  }

  const userIds = members.map((m: { user_id: string }) => m.user_id);

  // Fetch profiles (emails)
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("email, name")
    .in("id", userIds);

  const emailRecipients = (profiles ?? [])
    .map((p: { email: string; name: string }) => p.email)
    .filter(Boolean);

  const [year, month, day] = sessionDate.split("-").map(Number);
  const dateLabel = new Date(year, month - 1, day).toLocaleDateString("sv-SE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const subject = `⚠️ Inställt: ${sessionTitle}`;
  const html = `
    <p>Hej,</p>
    <p><strong>${sessionTitle}</strong> som var planerat <strong>${dateLabel} kl. ${sessionTime}</strong> är inställt.</p>
    <p><strong>Anledning:</strong> ${reason}</p>
    <p>Med vänliga hälsningar,<br/>Sport-IQ</p>
  `.trim();

  let emailed = 0;
  if (emailRecipients.length > 0) {
    try {
      await sendEmail({ to: emailRecipients, subject, html });
      emailed = emailRecipients.length;
    } catch (err) {
      console.error("[notify] Email failed:", err);
    }
  }

  return NextResponse.json({ sent: 0, emailed });
}
