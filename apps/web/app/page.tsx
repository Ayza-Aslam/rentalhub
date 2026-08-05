import { fetchListings } from "@/lib/api";
import styles from "./listings.module.css";
import { createElement } from "react";

export default async function Home() {
  const listings = await fetchListings();

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Find your next stay</h1>

      {listings.length === 0 ? (
        <p className={styles.empty}>No listings available right now.</p>
      ) : (
        <div className={styles.grid}>
          {listings.map((listing: any) =>
            createElement(
              "a",
              {
                key: listing.id,
                href: `/listings/${listing.id}`,
                className: styles.card,
              },
              createElement(
                "div",
                { className: styles.imageWrapper },
                listing.photoUrl
                  ? createElement("img", {
                      src: listing.photoUrl,
                      alt: listing.title,
                      className: styles.image,
                    })
                  : createElement(
                      "div",
                      { className: styles.imagePlaceholder },
                      "No photo"
                    )
              ),
              createElement(
                "div",
                { className: styles.cardBody },
                createElement("h2", { className: styles.cardTitle }, listing.title),
                createElement(
                  "p",
                  { className: styles.cardLocation },
                  `${listing.city}, ${listing.country}`
                ),
                createElement(
                  "p",
                  { className: styles.cardPrice },
                  `$${(listing.pricePerNight / 100).toFixed(2)} / night`
                )
              )
            )
          )}
        </div>
      )}
    </main>
  );
}
