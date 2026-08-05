import { fetchListingById } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import styles from "./listing.module.css";
import BookingWidget from "./BookingWidget";
import ChatBox from "./ChatBox";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await fetchListingById(id);

  if (!listing) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Link href="/" className={styles.back}>
        Back to listings
      </Link>

      {listing.photoUrl ? (
        <img src={listing.photoUrl} alt={listing.title} className={styles.image} />
      ) : (
        <div className={styles.imagePlaceholder}>No photo</div>
      )}

      <h1 className={styles.title}>{listing.title}</h1>
      <p className={styles.location}>
        {listing.city}, {listing.country}
      </p>
      <p className={styles.price}>
        ${(listing.pricePerNight / 100).toFixed(2)} / night
      </p>
      <p className={styles.description}>{listing.description}</p>

      <BookingWidget listingId={listing.id} pricePerNight={listing.pricePerNight} />

      <ChatBox listingId={listing.id} hostId={listing.hostId} />

      <div className={styles.reviewsSection}>
        <h2 className={styles.reviewsHeading}>
          {listing.averageRating
            ? `★ ${listing.averageRating.toFixed(1)} · ${listing.reviews.length} review${listing.reviews.length > 1 ? "s" : ""}`
            : "No reviews yet"}
        </h2>
        {listing.reviews.map((review: any) => (
          <div key={review.id} className={styles.reviewCard}>
            <p className={styles.reviewRating}>{"★".repeat(review.rating)}</p>
            <p className={styles.reviewComment}>{review.comment}</p>
          </div>
        ))}
      </div>

      <div className={styles.hostBox}>
        <p>Hosted by {listing.host?.name ?? "Unknown"}</p>
      </div>
    </main>
  );
}