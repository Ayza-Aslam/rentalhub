"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { socket } from "@/lib/socket";
import Link from "next/link";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!session) return;

    fetch(`${API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${session.user.apiToken}` },
    })
      .then((res) => res.json())
      .then(setNotifications);
  }, [session]);

  useEffect(() => {
    function handleNew(notification: Notification) {
      setNotifications((prev) => [notification, ...prev]);
    }

    socket.on("new-notification", handleNew);
    return () => {
      socket.off("new-notification", handleNew);
    };
  }, []);

  async function markRead(id: string) {
    if (!session) return;
    await fetch(`${API_URL}/notifications/${id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.user.apiToken}` },
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }

  if (!session) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ position: "relative", cursor: "pointer" }}>
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "red",
              color: "white",
              borderRadius: "50%",
              fontSize: 10,
              padding: "2px 5px",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            width: 300,
            maxHeight: 400,
            overflowY: "auto",
            background: "white",
            color: "black",
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: 8,
            zIndex: 50,
          }}
        >
          {notifications.length === 0 && <p style={{ padding: 8 }}>No notifications yet.</p>}
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "#"}
              onClick={() => markRead(n.id)}
              style={{
                display: "block",
                padding: 8,
                textDecoration: "none",
                color: "inherit",
                background: n.isRead ? "transparent" : "#f0f4ff",
                borderRadius: 6,
              }}
            >
              <strong style={{ fontSize: 13 }}>{n.title}</strong>
              <p style={{ fontSize: 12, margin: "2px 0 0", color: "#555" }}>{n.body}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}