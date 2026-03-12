/**
 * Firebase Cloud Messaging service worker.
 *
 * This file handles FCM push notifications when the app is in the background
 * or closed.  It is registered by AuthContext.tsx when the user logs in.
 *
 * The Firebase config is sent from the main page via `postMessage` after
 * registration so that config values stay in environment variables and
 * are not hard-coded here.
 *
 * Firebase compat SDK is loaded from CDN because ES-module imports are not
 * supported in all browsers' service-worker contexts.
 */

// eslint-disable-next-line no-undef
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
// eslint-disable-next-line no-undef
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

let messagingInitialised = false;

// Receive the Firebase config from the main page
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "INIT_FCM" && !messagingInitialised) {
    messagingInitialised = true;
    // eslint-disable-next-line no-undef
    firebase.initializeApp(event.data.config);
    // eslint-disable-next-line no-undef
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title ?? "Basketapp";
      const body  = payload.notification?.body  ?? "";
      const options = {
        body,
        icon: event.data.icon ?? "/next.svg",
        tag:  "session-cancellation",
        requireInteraction: false,
      };
      // eslint-disable-next-line no-restricted-globals
      self.registration.showNotification(title, options);
    });
  }
});

// Handle notification click: focus existing window or open a new one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // eslint-disable-next-line no-restricted-globals
  event.waitUntil(
    // eslint-disable-next-line no-undef
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        // eslint-disable-next-line no-undef
        if (clients.openWindow) return clients.openWindow("/");
      })
  );
});
