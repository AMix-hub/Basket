"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebaseClient";

/**
 * Returns the total count of unread messages (team chat + DMs)
 * for the currently logged-in user in their team.
 * Uses Firestore real-time listener for instant updates.
 */
export function useUnreadCount(): number {
  const { user, getMyTeam } = useAuth();
  const [count, setCount]   = useState(0);

  useEffect(() => {
    const team = getMyTeam();
    if (!user || !team) return;

    /* Listen to all messages in this team where the user is not the sender */
    const q = query(
      collection(db, "messages"),
      where("teamId", "==", team.id),
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      let unread = 0;
      snap.forEach((docSnap) => {
        const msg = docSnap.data();
        if (
          msg.senderId !== user.id &&
          !(msg.readBy as string[] ?? []).includes(user.id)
        ) {
          unread++;
        }
      });
      setCount(unread);
    });

    return () => unsubscribe();
  }, [user, getMyTeam]);

  return count;
}
