"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "./bookings.module.css";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function MyBookingsPage() {
  const { data: session, status } = useSession();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;

    fetch(`${API_URL}/bookings/mine`, {
      headers: { Authorization: `Bearer ${session.user.apiToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setBookings(data);
        setLoading(false);
      });
  }, [session]);

  if (status === "loading") return <p className={styles.status}>Loading...</p>;
  if (!session) return <p className={styles.status}>Please log in to see your bookings.</p>;
  if (loading) return <p className={styles.status}>Loading your bookings...</p>;

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>My Bookings</h1>

      {bookings.length === 0 ? (
        <p className={styles.status}>You haven't booked anything yet.</p>
      ) : (
        <div className={styles.list}>
          {bookings.map((booking) => (
            <Link
              key={booking.id}
              href={`/listings/${booking.listing.id}`}
              className={styles.card}
            >
              <div>
                <h2 className={styles.cardTitle}>{booking.listing.title}</h2>
                <p className={styles.cardLocation}>
                  {booking.listing.city}, {booking.listing.country}
                </p>
                <p className={styles.cardDates}>
                  {new Date(booking.checkIn).toLocaleDateString()} →{" "}
                  {new Date(booking.checkOut).toLocaleDateString()}
                </p>
              </div>
              <p className={styles.cardPrice}>
                ${(booking.totalPrice / 100).toFixed(2)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}