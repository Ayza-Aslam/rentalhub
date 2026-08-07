"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./form.module.css";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function NewListingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerNight, setPricePerNight] = useState("");
  const [maxGuests, setMaxGuests] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") {
    return <p className={styles.status}>Loading...</p>;
  }

  if (!session) {
    return <p className={styles.status}>You need to be logged in as a host to create a listing.</p>;
  }

  if (session.user.role !== "HOST") {
    return <p className={styles.status}>Only hosts can create listings.</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(`${API_URL}/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session!.user.apiToken}`,
      },
      body: JSON.stringify({
        title,
        description,
        pricePerNight: Number(pricePerNight) * 100,
        maxGuests: Number(maxGuests),
        city,
        country,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(Array.isArray(data.error) ? data.error.map((e: any) => e.message).join(", ") : data.error);
      return;
    }

    router.push(`/listings/${data.id}`);
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Create a listing</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.label}>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={styles.input} />
        </label>

        <label className={styles.label}>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={styles.textarea} />
        </label>

        <label className={styles.label}>
          Price per night (USD)
          <input type="number" min="1" value={pricePerNight} onChange={(e) => setPricePerNight(e.target.value)} className={styles.input} />
        </label>

        <label className={styles.label}>
          Max guests
          <input type="number" min="1" value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} className={styles.input} />
        </label>

        <label className={styles.label}>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} className={styles.input} />
        </label>

        <label className={styles.label}>
          Country
          <input value={country} onChange={(e) => setCountry(e.target.value)} className={styles.input} />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" disabled={submitting} className={styles.button}>
          {submitting ? "Creating..." : "Create listing"}
        </button>
      </form>
    </main>
  );
}