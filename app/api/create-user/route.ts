/**
 * POST /api/create-user
 *
 * Creates a new Supabase Auth user and profile, then sends a
 * password-reset e-mail so the new user can set their own password.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmail } from "../../../lib/email";

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (b) => chars[b % chars.length]
  ).join("");
}

export async function POST(req: NextRequest) {
  let body: { email?: string; name?: string; teamId?: string; role?: string; adminId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, name, teamId, role = "player", adminId } = body;
  if (!email || !name || !adminId) {
    return NextResponse.json({ error: "email, name, and adminId are required" }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured (SUPABASE_SERVICE_ROLE_KEY missing)" }, { status: 500 });
  }

  // Verify the caller is authenticated
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: { user: callerUser }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (authErr || !callerUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the caller has admin or co_admin role
  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("roles")
    .eq("id", callerUser.id)
    .single();
  const callerRoles: string[] = callerProfile?.roles ?? [];
  if (!callerRoles.some((r) => ["admin", "co_admin"].includes(r))) {
    return NextResponse.json({ error: "Forbidden: only admins can invite users" }, { status: 403 });
  }

  try {
    // Create the user (or look up existing)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let userId: string | null = null;
    const existing = existingUsers?.users.find((u) => u.email === email);

    if (existing) {
      userId = existing.id;
    } else {
      const tempPassword = generateCode() + generateCode();
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        user_metadata: { name, role, admin_id: adminId },
        email_confirm: true,
      });
      if (createErr) throw new Error(createErr.message);
      userId = created.user.id;
    }

    if (!userId) throw new Error("Could not determine user ID");

    // Ensure profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!existingProfile) {
      await supabaseAdmin.from("profiles").insert({
        id: userId, name, email, role, roles: [role], admin_id: adminId,
      });
    }

    // Add to team if provided
    if (teamId) {
      await supabaseAdmin.from("team_members")
        .upsert({ team_id: teamId, user_id: userId }, { onConflict: "team_id,user_id" });
      const { data: team } = await supabaseAdmin.from("teams").select("member_ids").eq("id", teamId).single();
      if (team) {
        const memberIds = [...new Set([...(team.member_ids ?? []), userId])];
        await supabaseAdmin.from("teams").update({ member_ids: memberIds }).eq("id", teamId);
      }
    }

    // Generate password reset link and send welcome email
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://sport-iq.se").replace(/\/$/, "");
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${baseUrl}/set-password` },
      });
      if (linkErr) throw linkErr;

      const setPasswordUrl = linkData?.properties?.action_link ?? `${baseUrl}/set-password`;
      await sendEmail({
        to: email,
        subject: "Välkommen – sätt ditt lösenord",
        html: `
          <p>Hej ${name},</p>
          <p>Du har blivit inbjuden till appen. Klicka på länken nedan för att sätta ditt lösenord:</p>
          <p><a href="${setPasswordUrl}">${setPasswordUrl}</a></p>
          <p>Välkommen!</p>
        `,
      });
    } catch (emailErr) {
      console.warn("[create-user] Failed to send welcome email:", emailErr);
    }

    return NextResponse.json({ uid: userId });
  } catch (err) {
    console.error("[create-user] Error:", err);
    return NextResponse.json({ error: "Kunde inte skapa användaren." }, { status: 500 });
  }
}
