const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function fetchListings(params?: {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  guests?: number;
}) {
  const query = new URLSearchParams();
  if (params?.city) query.set("city", params.city);
  if (params?.minPrice) query.set("minPrice", String(params.minPrice));
  if (params?.maxPrice) query.set("maxPrice", String(params.maxPrice));
  if (params?.guests) query.set("guests", String(params.guests));

  const res = await fetch(`${API_URL}/listings?${query.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to load listings");
  return res.json();
}

export async function fetchListingById(id: string) {
  const res = await fetch(`${API_URL}/listings/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load listing");
  return res.json();
}


export async function startConversation(listingId: string, apiToken: string) {
  const res = await fetch(`${API_URL}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ listingId }),
  });

  if (!res.ok) throw new Error("Failed to start conversation");
  return res.json();
}