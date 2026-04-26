import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function DELETE(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse optional targetUserId for admin-initiated deletion
  let targetUserId = user.id;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.userId && body.userId !== user.id) {
      // Only admins can delete other users
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles").select("roles").eq("id", user.id).single();
      const roles: string[] = callerProfile?.roles ?? [];
      if (!roles.some((r) => ["admin", "co_admin"].includes(r))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetUserId = body.userId;
    }
  } catch {
    // no body — self-deletion
  }

  // Delete storage files (avatars, logos) — best effort
  try {
    await supabaseAdmin.storage.from("avatars").remove([`${targetUserId}/avatar.jpg`, `${targetUserId}/avatar.png`, `${targetUserId}/avatar.webp`]);
    await supabaseAdmin.storage.from("club-logos").remove([`${targetUserId}/logo.jpg`, `${targetUserId}/logo.png`, `${targetUserId}/logo.webp`]);
  } catch {
    // ignore storage errors, proceed with account deletion
  }

  // Delete auth user — cascades to profiles → team_members, messages, attendance, rsvps, etc.
  const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
  if (deleteErr) {
    console.error("[delete-account]", deleteErr);
    return NextResponse.json({ error: "Kunde inte ta bort kontot." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
