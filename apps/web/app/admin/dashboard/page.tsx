"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import styles from "./admin.module.css";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!session) return;

    fetch(`${API_URL}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${session.user.apiToken}` },
    })
      .then((res) => res.json())
      .then(setData);
  }, [session]);

  async function toggleUserSuspend(userId: string) {
    await fetch(`${API_URL}/admin/users/${userId}/suspend`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session!.user.apiToken}` },
    });
    setData((prev: any) => ({
      ...prev,
      recentUsers: prev.recentUsers.map((u: any) =>
        u.id === userId ? { ...u, isSuspended: !u.isSuspended } : u
      ),
    }));
  }

  async function toggleListingActive(listingId: string) {
      await fetch(`${API_URL}/admin/listings/${listingId}/moderate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session!.user.apiToken}` },
    });
    setData((prev: any) => ({
      ...prev,
      allListings: prev.allListings.map((l: any) =>
        l.id === listingId ? { ...l, isActive: !l.isActive } : l
      ),
    }));
  }

  if (status === "loading") return <p className={styles.status}>Loading...</p>;
  if (!session) return <p className={styles.status}>Please log in.</p>;
  if (session.user.role !== "ADMIN") return <p className={styles.status}>Admins only.</p>;
  if (!data) return <p className={styles.status}>Loading dashboard...</p>;

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Admin Dashboard</h1>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <p className={styles.statValue}>${(data.totalPlatformRevenue / 100).toFixed(2)}</p>
          <p className={styles.statLabel}>Platform revenue</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>${(data.totalGrossVolume / 100).toFixed(2)}</p>
          <p className={styles.statLabel}>Gross volume</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{data.totalBookings}</p>
          <p className={styles.statLabel}>Bookings</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{data.totalUsers}</p>
          <p className={styles.statLabel}>Users</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{data.totalHosts}</p>
          <p className={styles.statLabel}>Hosts</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{data.totalListings}</p>
          <p className={styles.statLabel}>Listings</p>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>Recent users</h2>
      <div className={styles.list}>
        {data.recentUsers.map((u: any) => (
          <div key={u.id} className={styles.row}>
            <div>
              <p className={styles.rowTitle}>{u.name}</p>
              <p className={styles.rowSub}>{u.email} · {u.role}</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className={u.isSuspended ? styles.badgeSuspended : styles.badgeActive}>
                {u.isSuspended ? "Suspended" : "Active"}
              </span>
              <button onClick={() => toggleUserSuspend(u.id)} className={styles.actionButton}>
                {u.isSuspended ? "Unsuspend" : "Suspend"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionHeading}>Listings</h2>
      <div className={styles.list}>
        {data.allListings.map((l: any) => (
          <div key={l.id} className={styles.row}>
            <div>
              <p className={styles.rowTitle}>{l.title}</p>
              <p className={styles.rowSub}>Hosted by {l.host.name}</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className={l.isActive ? styles.badgeActive : styles.badgeSuspended}>
                {l.isActive ? "Active" : "Inactive"}
              </span>
              <button onClick={() => toggleListingActive(l.id)} className={styles.actionButton}>
                {l.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}