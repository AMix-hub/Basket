/**
 * POST /api/notify
 *
 * Sends a push notification (via Firebase Cloud Messaging) and optionally
 * queues an e-mail (via the Firebase Trigger Email extension's `mail`
 * collection) to all members of a team when a session is cancelled.
 *
 * Request body (JSON):
 * {
 *   teamId:       string   – Firestore team document ID
 *   sessionTitle: string   – Name of the cancelled session
 *   sessionDate:  string   – YYYY-MM-DD
 *   sessionTime:  string   – HH:MM
 *   reason:       string   – Cancellation reason written by the coach
 * }
 *
 * Response:
 *   200 { sent: number, emailed: number }   – number of push/email attempts
 *   400 { error: string }                   – bad request
 *   500 { error: string }                   – server error
 *
 * Dependencies:
 *   • FIREBASE_SERVICE_ACCOUNT env var (server-side, never exposed to browser)
 *   • Firebase Admin SDK (firebase-admin npm package)
 *   • Optional: Firebase Trigger Email extension installed in your project
 *     (https://extensions.dev/extensions/firebase/firestore-send-email)
 *     for the email side to actually send.  Without it the `mail` documents
 *     are written but never dispatched.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminMessaging, adminDb } from "../../../lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  /* ── 1. Parse + validate request body ── */
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
    return NextResponse.json(
      { error: "teamId, sessionTitle, sessionDate, sessionTime, and reason are required" },
      { status: 400 }
    );
  }

  /* ── 2. Guard: Admin SDK must be initialised ── */
  if (!adminDb) {
    return NextResponse.json(
      { error: "Server notifications are not configured (FIREBASE_SERVICE_ACCOUNT missing)" },
      { status: 500 }
    );
  }

  /* ── 3. Fetch team members ── */
  const membersSnap = await adminDb
    .collection("team_members")
    .where("teamId", "==", teamId)
    .get();

  if (membersSnap.empty) {
    return NextResponse.json({ sent: 0, emailed: 0 });
  }

  const memberIds: string[] = membersSnap.docs.map((d) => d.data().userId as string);

  /* ── 4. Fetch profiles (in parallel, batches of 10) ── */
  const profiles: Array<{ userId: string; fcmToken?: string; email?: string; name?: string }> = [];
  for (let i = 0; i < memberIds.length; i += 10) {
    const chunk = memberIds.slice(i, i + 10);
    const profileDocs = await Promise.all(
      chunk.map((uid) => adminDb!.collection("profiles").doc(uid).get())
    );
    for (const snap of profileDocs) {
      if (snap.exists) {
        const d = snap.data()!;
        profiles.push({
          userId: snap.id,
          fcmToken: (d.fcmToken as string | undefined) ?? undefined,
          // Email is stored in the profile document by AuthContext on registration.
          email: (d.email as string | undefined) ?? undefined,
          name: (d.name as string | undefined) ?? undefined,
        });
      }
    }
  }

  /* ── 5. Build human-readable date label ── */
  const [year, month, day] = sessionDate.split("-").map(Number);
  const dateLabel = new Date(year, month - 1, day).toLocaleDateString("sv-SE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const notificationTitle = `⚠️ Inställt: ${sessionTitle}`;
  const notificationBody  = `${dateLabel} kl. ${sessionTime}\nAnledning: ${reason}`;

  /* ── 6. Send FCM push notifications ── */
  let sent = 0;
  if (adminMessaging) {
    const tokens = profiles
      .map((p) => p.fcmToken)
      .filter((t): t is string => !!t);

    if (tokens.length > 0) {
      // sendEachForMulticast handles up to 500 tokens per call
      const CHUNK = 500;
      for (let i = 0; i < tokens.length; i += CHUNK) {
        const chunk = tokens.slice(i, i + CHUNK);
        const result = await adminMessaging.sendEachForMulticast({
          tokens: chunk,
          notification: {
            title: notificationTitle,
            body: notificationBody,
          },
          webpush: {
            notification: {
              icon: "/next.svg",
              tag: "session-cancellation",
              requireInteraction: false,
            },
          },
        });
        sent += result.successCount;
        // Clean up invalid tokens
        result.responses.forEach((resp, idx) => {
          if (
            !resp.success &&
            (resp.error?.code === "messaging/invalid-registration-token" ||
              resp.error?.code === "messaging/registration-token-not-registered")
          ) {
            const badToken = chunk[idx];
            // Remove the stale token from the owner's profile
            profiles
              .filter((p) => p.fcmToken === badToken)
              .forEach((p) => {
                adminDb!
                  .collection("profiles")
                  .doc(p.userId)
                  .update({ fcmToken: null })
                  .catch(() => {});
              });
          }
        });
      }
    }
  }

  /* ── 7. Write mail documents (Firebase Trigger Email extension) ── */
  let emailed = 0;
  const emailRecipients = profiles
    .map((p) => p.email)
    .filter((e): e is string => !!e);

  if (emailRecipients.length > 0) {
    const mailSubject = notificationTitle;
    const mailHtml = `
      <p>Hej,</p>
      <p>
        <strong>${sessionTitle}</strong> som var planerat
        <strong>${dateLabel} kl. ${sessionTime}</strong> är inställt.
      </p>
      <p><strong>Anledning:</strong> ${reason}</p>
      <p>Med vänliga hälsningar,<br/>Basketappen</p>
    `.trim();

    try {
      await adminDb.collection("mail").add({
        to: emailRecipients,
        message: {
          subject: mailSubject,
          html: mailHtml,
        },
        createdAt: new Date().toISOString(),
        teamId,
      });
      emailed = emailRecipients.length;
    } catch {
      // Non-fatal: email extension may not be installed
    }
  }

  return NextResponse.json({ sent, emailed });
}
