import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET(req: NextRequest) {
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

  const uid = user.id;

  // Collect all user data in parallel
  const [
    { data: profile },
    { data: memberships },
    { data: rsvps },
    { data: attendance },
    { data: messages },
    { data: carpools },
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, name, email, role, roles, phone, bio, position, child_name, sport, created_at").eq("id", uid).single(),
    supabaseAdmin.from("team_members").select("team_id, joined_at").eq("user_id", uid),
    supabaseAdmin.from("rsvps").select("session_id, status, comment, created_at").eq("user_id", uid),
    supabaseAdmin.from("attendance").select("session_id, status").eq("player_id", uid),
    supabaseAdmin.from("messages").select("team_id, content, created_at").eq("sender_id", uid),
    supabaseAdmin.from("carpools").select("session_id, type, created_at").eq("user_id", uid),
  ]);

  const export_data = {
    exported_at: new Date().toISOString(),
    profile,
    team_memberships: memberships ?? [],
    rsvps: rsvps ?? [],
    attendance: attendance ?? [],
    messages_sent: messages ?? [],
    carpools: carpools ?? [],
  };

  return new NextResponse(JSON.stringify(export_data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="min-data-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
