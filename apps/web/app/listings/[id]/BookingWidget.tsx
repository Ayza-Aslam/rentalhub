"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./listing.module.css";
import { socket } from "@/lib/socket";

export default function BookingWidget({
  listingId,
  pricePerNight,
}: {
  listingId: string;
  pricePerNight: number;
}) {
  const { data: session } = useSession();
  const router = useRouter();

  const [bookedRanges, setBookedRanges] = useState<{ checkIn: string; checkOut: string }[]>([]);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
  fetch(`http://localhost:4000/listings/${listingId}/availability`)
    .then((res) => res.json())
    .then(setBookedRanges);

  socket.emit("join-listing", listingId);

  function handleAvailabilityUpdate() {
    fetch(`http://localhost:4000/listings/${listingId}/availability`)
      .then((res) => res.json())
      .then(setBookedRanges);
  }

  socket.on("availability-updated", handleAvailabilityUpdate);

  return () => {
    socket.off("availability-updated", handleAvailabilityUpdate);
  };
}, [listingId]);

  const nights =
    checkIn && checkOut
      ? Math.round(
          (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0;

  const totalPrice = nights > 0 ? nights * pricePerNight : 0;

  async function handleBook() {
  setError(null);

  if (!session) {
    setError("Please log in to book this listing.");
    return;
  }

  if (!checkIn || !checkOut || nights <= 0) {
    setError("Please choose a valid check-in and check-out date.");
    return;
  }

  setSubmitting(true);

  const res = await fetch("http://localhost:4000/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.user.apiToken}`,
    },
    body: JSON.stringify({ listingId, checkIn, checkOut }),
  });

  const data = await res.json();

  if (!res.ok) {
    setSubmitting(false);
    setError(typeof data.error === "string" ? data.error : "Something went wrong.");
    return;
  }

  window.location.href = data.checkoutUrl;
}

  return (
    <div className={styles.bookingBox}>
      <p className={styles.bookingPrice}>
        ${(pricePerNight / 100).toFixed(2)} <span>/ night</span>
      </p>

      <div className={styles.dateRow}>
        <label className={styles.dateLabel}>
          Check-in
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className={styles.dateInput}
          />
        </label>
        <label className={styles.dateLabel}>
          Check-out
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className={styles.dateInput}
          />
        </label>
      </div>

      {nights > 0 && (
        <p className={styles.bookingSummary}>
          {nights} night{nights > 1 ? "s" : ""} · ${(totalPrice / 100).toFixed(2)} total
        </p>
      )}

      {bookedRanges.length > 0 && (
        <p className={styles.bookedNote}>
          {bookedRanges.length} date range{bookedRanges.length > 1 ? "s are" : " is"} already booked, you'll see an error if you pick overlapping dates.
        </p>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button onClick={handleBook} disabled={submitting} className={styles.bookButton}>
        {submitting ? "Booking..." : "Book now"}
      </button>
    </div>
  );
}