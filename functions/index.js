const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Resend } = require("resend");

admin.initializeApp();

// Vi hämtar nyckeln från Firebase config
const resendApiKey = functions.config().resend && functions.config().resend.key;
if (!resendApiKey) {
  throw new Error("resend.key is not configured. Run: firebase functions:config:set resend.key=YOUR_API_KEY");
}
const resend = new Resend(resendApiKey);

exports.processEmailTrigger = functions.firestore
  .document("mail/{mailId}")
  .onCreate(async (snap, context) => {
    const mailData = snap.data();

    try {
      const { error } = await resend.emails.send({
        from: "no-reply@sport-iq.se",
        to: mailData.to,
        subject: mailData.message.subject,
        html: mailData.message.html,
      });

      if (error) {
        throw new Error(error.message);
      }

      return snap.ref.update({
        delivery: {
          state: "SUCCESS",
          endTime: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    } catch (error) {
      console.error("Resend Error:", error);
      return snap.ref.update({
        delivery: {
          state: "ERROR",
          error: error.toString(),
        },
      });
    }
  });
