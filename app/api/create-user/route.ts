/**
 * POST /api/create-user
 *
 * Creates a new Firebase Auth user and Firestore profile, then sends a
 * password-reset e-mail so the new user can set their own password.
 *
 * Request body (JSON):
 * {
 *   email:    string   – e-mail address for the new account
 *   name:     string   – display name
 *   teamId:   string   – team ID to add the user to (optional)
 *   role:     string   – initial role (defaults to "player")
 *   adminId:  string   – ID of the admin creating the user
 * }
 *
 * Response:
 *   200 { uid: string }     – newly created user UID
 *   400 { error: string }   – bad request
 *   500 { error: string }   – server error
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebaseAdmin";
import { sendEmail } from "../../../lib/email";

export async function POST(req: NextRequest) {
  /* ── 1. Parse + validate request body ── */
  let body: {
    email?: string;
    name?: string;
    teamId?: string;
    role?: string;
    adminId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, name, teamId, role = "player", adminId } = body;
  if (!email || !name || !adminId) {
    return NextResponse.json(
      { error: "email, name, and adminId are required" },
      { status: 400 }
    );
  }

  if (!adminDb) {
    return NextResponse.json(
      { error: "Server not configured (FIREBASE_SERVICE_ACCOUNT missing)" },
      { status: 500 }
    );
  }

  try {
    // Import Firebase Admin Auth dynamically (server-only)
    const { getAuth } = await import("firebase-admin/auth");
    const { getApps } = await import("firebase-admin/app");
    const apps = getApps();
    if (apps.length === 0) {
      return NextResponse.json(
        { error: "Firebase Admin not initialized" },
        { status: 500 }
      );
    }
    const adminAuth = getAuth(apps[0]);

    // Create the user in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email,
        displayName: name,
        // No password set – user will receive a reset link to set their own
      });
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr.code === "auth/email-already-exists") {
        // User already exists – fetch them instead
        userRecord = await adminAuth.getUserByEmail(email);
      } else {
        throw err;
      }
    }

    const uid = userRecord.uid;

    // Create or update Firestore profile
    const profileRef = adminDb.collection("profiles").doc(uid);
    const existingProfile = await profileRef.get();
    if (!existingProfile.exists) {
      await profileRef.set({
        name,
        email,
        roles: [role],
        role,
        teamId: teamId ?? null,
        // Link the user to the inviting admin so the admin's registry shows them
        adminId: adminId ?? null,
        createdAt: new Date().toISOString(),
      });
    }

    // If teamId is provided, add to team_members and team's memberIds
    if (teamId) {
      const memberDocRef = adminDb.collection("team_members").doc(`${teamId}_${uid}`);
      const existing = await memberDocRef.get();
      if (!existing.exists) {
        await memberDocRef.set({
          teamId,
          userId: uid,
          role,
          joinedAt: new Date().toISOString(),
        });
        // Update team's memberIds array
        const teamRef = adminDb.collection("teams").doc(teamId);
        const teamDoc = await teamRef.get();
        if (teamDoc.exists) {
          const memberIds: string[] = (teamDoc.data()?.memberIds as string[]) ?? [];
          if (!memberIds.includes(uid)) {
            await teamRef.update({
              memberIds: [...memberIds, uid],
            });
          }
        }
      }
    }

    // Send password-reset email so user can set their own password
    try {
      // Normalize the base URL: strip trailing slash and remove any "www." prefix
      // so that the link in the email always resolves correctly even if the env
      // variable was accidentally set with "www." (e.g. https://www.sport-iq.se).
      const rawBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.NEXT_PUBLIC_BASE_URL ??
        "https://sport-iq.se";
      let baseUrl = rawBaseUrl.replace(/\/$/, "");
      try {
        const parsed = new URL(baseUrl);
        parsed.hostname = parsed.hostname.replace(/^www\./, "");
        baseUrl = parsed.toString().replace(/\/$/, "");
      } catch {
        // If URL parsing fails, proceed with the raw value
      }

      const firebaseResetLink = await adminAuth.generatePasswordResetLink(email, {
        // Redirect the user to the app after Firebase has processed the action.
        // This domain must be listed in Firebase Console →
        // Authentication → Settings → Authorized domains.
        url: baseUrl,
      });

      // Build a direct link to the app's own set-password page using the
      // oobCode from the Firebase password reset link.  This avoids any
      // intermediate redirect through the Firebase-hosted action handler (which
      // may be configured with a different domain) and lands the user directly
      // on the correct page without www-related DNS issues.
      let setPasswordUrl = firebaseResetLink;
      try {
        const parsedActionUrl = new URL(firebaseResetLink);
        const oobCode = parsedActionUrl.searchParams.get("oobCode");
        if (oobCode) {
          setPasswordUrl = `${baseUrl}/set-password?oobCode=${encodeURIComponent(oobCode)}`;
        }
      } catch {
        // Fallback: keep the original Firebase action URL
      }

      // Send welcome email directly via SendGrid
      await sendEmail({
        to: email,
        subject: "Välkommen – sätt ditt lösenord",
        html: `
          <p>Hej ${name},</p>
          <p>Du har blivit inbjuden till appen. Klicka på länken nedan för att sätta ditt lösenord och aktivera ditt konto:</p>
          <p><a href="${setPasswordUrl}">${setPasswordUrl}</a></p>
          <p>Länken är giltig i en begränsad tid (Firebase standard).</p>
          <p>Välkommen!</p>
        `,
      });
    } catch (emailErr) {
      // Non-fatal: user is created, just the email failed
      console.warn("[create-user] Failed to send welcome email:", emailErr);
    }

    return NextResponse.json({ uid });
  } catch (err: unknown) {
    console.error("[create-user] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
