"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "./dashboard.module.css";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function HostDashboardPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!session) return;

    fetch(`${API_URL}/host/dashboard`, {
      headers: { Authorization: `Bearer ${session.user.apiToken}` },
    })
      .then((res) => res.json())
      .then(setData);
  }, [session]);

  if (status === "loading") return <p className={styles.status}>Loading...</p>;
  if (!session) return <p className={styles.status}>Please log in as a host.</p>;
  if (session.user.role !== "HOST") return <p className={styles.status}>Hosts only.</p>;
  if (!data) return <p className={styles.status}>Loading dashboard...</p>;

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Host Dashboard</h1>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <p className={styles.statValue}>${(data.totalEarnings / 100).toFixed(2)}</p>
          <p className={styles.statLabel}>Total earnings</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{data.totalBookings}</p>
          <p className={styles.statLabel}>Total bookings</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{data.listings.length}</p>
          <p className={styles.statLabel}>Listings</p>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>Upcoming bookings</h2>
      {data.upcomingBookings.length === 0 ? (
        <p className={styles.status}>No upcoming bookings.</p>
      ) : (
        <div className={styles.list}>
          {data.upcomingBookings.map((b: any) => (
            <div key={b.id} className={styles.bookingCard}>
              <p className={styles.bookingTitle}>{b.listing.title}</p>
              <p className={styles.bookingDates}>
                {new Date(b.checkIn).toLocaleDateString()} → {new Date(b.checkOut).toLocaleDateString()}
              </p>
              <p className={styles.bookingPrice}>${(b.totalPrice / 100).toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}

      <h2 className={styles.sectionHeading}>Your listings</h2>
      <div className={styles.list}>
        {data.listings.map((l: any) => (
          <Link key={l.id} href={`/listings/${l.id}`} className={styles.listingCard}>
            <p className={styles.bookingTitle}>{l.title}</p>
            <p className={styles.bookingDates}>{l.isActive ? "Active" : "Inactive"}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}