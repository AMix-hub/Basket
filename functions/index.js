const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

admin.initializeApp();

// Vi hämtar nyckeln från Firebase config
const API_KEY = functions.config().sendgrid.key;
sgMail.setApiKey(API_KEY);

exports.processEmailTrigger = functions.firestore
  .document("mail/{mailId}")
  .onCreate(async (snap, context) => {
    const mailData = snap.data();

    const msg = {
      to: mailData.to,
      from: "no-reply@sport-iq.se", 
      subject: mailData.message.subject,
      html: mailData.message.html,
    };

    try {
      await sgMail.send(msg);
      return snap.ref.update({
        delivery: {
          state: "SUCCESS",
          endTime: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    } catch (error) {
      console.error("SendGrid Error:", error);
      return snap.ref.update({
        delivery: {
          state: "ERROR",
          error: error.toString(),
        },
      });
    }
  });
