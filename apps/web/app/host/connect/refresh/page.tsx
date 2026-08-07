"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ConnectRefreshPage() {
  const { data: session } = useSession();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;

    fetch(`${API_URL}/host/connect`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.user.apiToken}` },
    })
      .then((res) => res.json())
      .then((data) => setUrl(data.url));
  }, [session]);

  return (
    <main style={{ maxWidth: 500, margin: "60px auto", textAlign: "center" }}>
      <h1>Your onboarding link expired</h1>
      {url ? (
        <a href={url}>Click here to continue</a>
      ) : (
        <p>Generating a new link...</p>
      )}
    </main>
  );
}
