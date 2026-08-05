"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { socket } from "@/lib/socket";

export default function SocketConnector() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session) return;

    socket.auth = { token: session.user.apiToken };
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [session]);

  return null;
}