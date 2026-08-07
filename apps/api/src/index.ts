import "dotenv/config";
import express from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "./middleware/auth";
import { v2 as cloudinary } from "cloudinary";  
import multer from "multer";   
import cors from "cors";
import Stripe from "stripe";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import rateLimit from "express-rate-limit";
import { Resend } from "resend";


const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const app = express();
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;

        if (bookingId) {
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CONFIRMED" },
  });
  console.log(`Booking ${bookingId} confirmed via webhook`);

  io.to(`listing:${updatedBooking.listingId}`).emit("availability-updated");

  const guest = await prisma.user.findUnique({ where: { id: updatedBooking.guestId } });
  const listingForEmail = await prisma.listing.findUnique({ where: { id: updatedBooking.listingId } });

      if (guest && listingForEmail) {
        await sendEmail(
          guest.email,
          "Your booking is confirmed!",
          `<h2>Booking Confirmed</h2>
          <p>Hi ${guest.name},</p>
          <p>Your booking for <strong>${listingForEmail.title}</strong> is confirmed.</p>
          <p>Check-in: ${new Date(updatedBooking.checkIn).toDateString()}<br/>
          Check-out: ${new Date(updatedBooking.checkOut).toDateString()}<br/>
          Total: $${(updatedBooking.totalPrice / 100).toFixed(2)}</p>`
        );

        const host = await prisma.user.findUnique({ where: { id: listingForEmail.hostId } });

        if (host) {
          const platformFeePercent = 0.1;
          const hostPayout = Math.round(updatedBooking.totalPrice * (1 - platformFeePercent));

          await sendEmail(
            host.email,
            "You've received a new booking payout",
            `<h2>New Payout</h2>
            <p>Hi ${host.name},</p>
            <p>You have a new confirmed booking for <strong>${listingForEmail.title}</strong>.</p>
            <p>Payout amount: $${(hostPayout / 100).toFixed(2)}</p>`
          );
        }
      }
    }
  }

  res.json({ received: true });
});
app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:3000",
    process.env.FRONTEND_URL || "",
  ].filter(Boolean),
}));


cloudinary.config({                                
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const upload = multer({ storage: multer.memoryStorage() });

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const resend = new Resend(process.env.RESEND_API_KEY);


const PORT = process.env.PORT ?? 4000;

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  
  if (user.isSuspended) {
    return res.status(403).json({ error: "This account has been suspended" });
  }


  const passwordMatches = await bcrypt.compare(password, user.hashedPassword);

  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const apiToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.AUTH_SECRET!,
    { expiresIn: "30d" }
  );

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    apiToken,
  });
});

app.post("/auth/signup", authLimiter, async (req, res) => {
  const { name, email, password, role } = req.body;

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const allowedRoles = ["GUEST", "HOST"];
  const finalRole = allowedRoles.includes(role) ? role : "GUEST";

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      hashedPassword,
      role: finalRole,
    },
  });

  const apiToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.AUTH_SECRET!,
    { expiresIn: "30d" }
  );

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    apiToken,
  });
});

const createListingSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  pricePerNight: z.number().int().positive(),
  maxGuests: z.number().int().positive(),
  city: z.string().min(1),
  country: z.string().min(1),
});

app.post("/listings", requireAuth, requireRole("HOST"), async (req: AuthRequest, res) => {
  const parseResult = createListingSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.issues });
  }


  const { title, description, pricePerNight, maxGuests, city, country } = parseResult.data;

  const listing = await prisma.listing.create({
    data: {
      hostId: req.userId!,
      title,
      description,
      pricePerNight,
      maxGuests,
      city,
      country,
    },
  });

  res.status(201).json(listing);
});

app.get("/listings/:id", async (req, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id as string },
    include: {
      host: {
        select: { id: true, name: true },
      },
    },
  });

  if (!listing || !listing.isActive) {
    return res.status(404).json({ error: "Listing not found" });
  }

  const reviews = await prisma.review.findMany({
    where: { listingId: listing.id },
    orderBy: { createdAt: "desc" },
  });

  const averageRating =
    reviews.length > 0
     ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : null;

  res.json({ ...listing, reviews, averageRating });
});

app.get("/listings", async (req, res) => {
  const { city, minPrice, maxPrice, guests } = req.query;

  const where: any = { isActive: true };

  if (city) {
    where.city = { equals: city as string, mode: "insensitive" };
  }

  if (minPrice || maxPrice) {
    where.pricePerNight = {};
    if (minPrice) where.pricePerNight.gte = Number(minPrice);
    if (maxPrice) where.pricePerNight.lte = Number(maxPrice);
  }

  if (guests) {
    where.maxGuests = { gte: Number(guests) };
  }

  const listings = await prisma.listing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      host: { select: { id: true, name: true } },
    },
  });

  res.json(listings);
});

const updateListingSchema = createListingSchema.partial();

app.patch("/listings/:id", requireAuth, requireRole("HOST"), async (req: AuthRequest, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id as string },
  });

  if (!listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  if (listing.hostId !== req.userId) {
    return res.status(403).json({ error: "You don't own this listing" });
  }

  const parseResult = updateListingSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.issues });
  }

  const updated = await prisma.listing.update({
    where: { id: req.params.id as string },
    data: parseResult.data,
  });

  res.json(updated);
});


app.delete("/listings/:id", requireAuth, requireRole("HOST"), async (req: AuthRequest, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id as string },
  });

  if (!listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  if (listing.hostId !== req.userId) {
    return res.status(403).json({ error: "You don't own this listing" });
  }

  await prisma.listing.update({
    where: { id: req.params.id as string },
    data: { isActive: false },
  });

  res.status(204).send();
});


app.post(
  "/listings/:id/photo",
  requireAuth,
  requireRole("HOST"),
  upload.single("photo"),
  async (req: AuthRequest, res) => {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id as string },
    });

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.hostId !== req.userId) {
      return res.status(403).json({ error: "You don't own this listing" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No photo uploaded" });
    }

    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "rentalhub-listings" },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file!.buffer);
    });

    const updated = await prisma.listing.update({
      where: { id: req.params.id as string },
      data: { photoUrl: uploadResult.secure_url },
    });

    res.json(updated);
  }
);


const createBookingSchema = z.object({
  listingId: z.string(),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
});

app.post("/bookings", requireAuth, async (req: AuthRequest, res) => {
  const parseResult = createBookingSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.issues });
  }

  const { listingId, checkIn, checkOut } = parseResult.data;

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (checkOutDate <= checkInDate) {
    return res.status(400).json({ error: "Check-out must be after check-in" });
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });

  if (!listing || !listing.isActive) {
    return res.status(404).json({ error: "Listing not found" });
  }

  const totalNights = Math.round(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalPrice = totalNights * listing.pricePerNight;

  let booking;

  try {
    booking = await prisma.booking.create({
      data: {
        listingId,
        guestId: req.userId!,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        status: "PENDING",
        totalPrice,
      },
    });

    await sendNotification(
    listing.hostId,
    "NEW_BOOKING",
    "New booking request",
    `Someone requested to book ${listing.title}`,
    `/bookings/mine`
  );

  } catch (err: any) {
    if (err.code === "P2010" || err.message?.includes("no_overlapping_bookings")) {
      return res.status(409).json({ error: "These dates are no longer available" });
    }
    throw err;
  }

  const host = await prisma.user.findUnique({ where: { id: listing.hostId } });

  if (!host?.stripeAccountId) {
    await prisma.booking.delete({ where: { id: booking.id } });
    return res.status(400).json({ error: "This host hasn't set up payouts yet" });
  }

  const platformFeePercent = 0.1;
  const applicationFeeAmount = Math.round(totalPrice * platformFeePercent);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: listing.title },
          unit_amount: totalPrice,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: host.stripeAccountId,
      },
    },
    success_url: `http://localhost:3000/bookings/mine?success=true`,
    cancel_url: `http://localhost:3000/listings/${listingId}?canceled=true`,
    metadata: { bookingId: booking.id },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { stripeSessionId: session.id },
  });

  res.status(201).json({ bookingId: booking.id, checkoutUrl: session.url });
});


app.get("/listings/:id/availability", async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: {
      listingId: req.params.id as string,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: {
      checkIn: true,
      checkOut: true,
    },
  });

  res.json(bookings);
});


app.get("/bookings/mine", requireAuth, async (req: AuthRequest, res) => {
  const bookings = await prisma.booking.findMany({
    where: { guestId: req.userId! },
    orderBy: { checkIn: "desc" },
    include: {
      listing: {
        select: { id: true, title: true, city: true, country: true, photoUrl: true },
      },
    },
  });

  res.json(bookings);
});


app.get("/notifications", requireAuth, async (req: AuthRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json(notifications);
});

app.post("/notifications/:id/read", requireAuth, async (req: AuthRequest, res) => {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id as string },
  });

  if (!notification || notification.userId !== req.userId) {
    return res.status(404).json({ error: "Notification not found" });
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });

  res.json(updated);
});


app.post("/conversations", requireAuth, async (req: AuthRequest, res) => {
  const { listingId } = req.body;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });

  if (!listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  const guestId = req.userId!;

  let conversation = await prisma.conversation.findUnique({
    where: { listingId_guestId: { listingId, guestId } },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        listingId,
        guestId,
        hostId: listing.hostId,
      },
    });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });

  res.json({ conversation, messages });
});


app.post("/bookings/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id as string },
  });

  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }

  const isOwner = booking.guestId === req.userId;
  const isAdmin = req.userRole === "ADMIN";

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "You can't cancel this booking" });
  }

  if (booking.status === "CANCELLED") {
    return res.status(400).json({ error: "This booking is already cancelled" });
  }

  if (booking.status === "CONFIRMED" && booking.stripeSessionId) {
    const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);

    if (session.payment_intent) {
      await stripe.refunds.create({
        payment_intent: session.payment_intent as string,
      });
    }
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED" },
  });

  const cancelledGuest = await prisma.user.findUnique({ where: { id: updated.guestId } });
  const cancelledListing = await prisma.listing.findUnique({ where: { id: updated.listingId } });

  if (cancelledGuest && cancelledListing) {
    await sendEmail(
      cancelledGuest.email,
      "Your booking has been cancelled",
      `<h2>Booking Cancelled</h2>
       <p>Hi ${cancelledGuest.name},</p>
       <p>Your booking for <strong>${cancelledListing.title}</strong>
       (${new Date(updated.checkIn).toDateString()} → ${new Date(updated.checkOut).toDateString()})
       has been cancelled${booking.stripeSessionId ? " and refunded" : ""}.</p>`
    );
  }

  res.json(updated);
});


const createReviewSchema = z.object({
  bookingId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(5).max(1000),
});

app.post("/reviews", requireAuth, async (req: AuthRequest, res) => {
  const parseResult = createReviewSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.issues });
  }

  const { bookingId, rating, comment } = parseResult.data;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }

  if (booking.guestId !== req.userId) {
    return res.status(403).json({ error: "This isn't your booking" });
  }

  if (booking.status !== "CONFIRMED") {
    return res.status(400).json({ error: "Only confirmed bookings can be reviewed" });
  }

  if (new Date(booking.checkOut) > new Date()) {
    return res.status(400).json({ error: "You can only review a stay after checkout" });
  }

  const existingReview = await prisma.review.findUnique({ where: { bookingId } });

  if (existingReview) {
    return res.status(409).json({ error: "You've already reviewed this booking" });
  }

  const review = await prisma.review.create({
    data: {
      bookingId,
      listingId: booking.listingId,
      guestId: req.userId!,
      rating,
      comment,
    },
  });

  res.status(201).json(review);
});



app.get("/host/dashboard", requireAuth, requireRole("HOST"), async (req: AuthRequest, res) => {
  const hostId = req.userId!;

  const listings = await prisma.listing.findMany({
    where: { hostId },
    orderBy: { createdAt: "desc" },
  });

  const listingIds = listings.map((l: any) => l.id);

  const bookings = await prisma.booking.findMany({
    where: {
      listingId: { in: listingIds },
      status: "CONFIRMED",
    },
    include: {
      listing: { select: { title: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  const now = new Date();
  const upcomingBookings = bookings.filter((b: any) => new Date(b.checkOut) >= now);
  const pastBookings = bookings.filter((b: any) => new Date(b.checkOut) < now);

  const platformFeePercent = 0.1;
  const totalEarnings = bookings.reduce(
    (sum: number, b: any) => sum + Math.round(b.totalPrice * (1 - platformFeePercent)),
    0
  );

  res.json({
    listings,
    upcomingBookings,
    pastBookingsCount: pastBookings.length,
    totalEarnings,
    totalBookings: bookings.length,
  });
});


app.post("/host/connect", requireAuth, requireRole("HOST"), async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  let accountId = user.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    accountId = account.id;

    await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountId: accountId },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: "http://localhost:3000/host/connect/refresh",
    return_url: "http://localhost:3000/host/connect/complete",
    type: "account_onboarding",
  });

  res.json({ url: accountLink.url });
});

app.get("/host/connect/status", requireAuth, requireRole("HOST"), async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });

  if (!user?.stripeAccountId) {
    return res.status(404).json({ error: "No connected account yet" });
  }

  const account = await stripe.accounts.retrieve(user.stripeAccountId);

  res.json({
    id: account.id,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
    requirements: account.requirements,
  });
});


app.get("/admin/dashboard", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const allBookings = await prisma.booking.findMany({
    where: { status: "CONFIRMED" },
  });

  const platformFeePercent = 0.1;
  const totalPlatformRevenue = allBookings.reduce(
    (sum: number, b: any) => sum + Math.round(b.totalPrice * platformFeePercent),
    0
  );
  const totalGrossVolume = allBookings.reduce((sum: number, b: any) => sum + b.totalPrice, 0);

  const totalUsers = await prisma.user.count();
  const totalListings = await prisma.listing.count();
  const totalHosts = await prisma.user.count({ where: { role: "HOST" } });

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, name: true, email: true, role: true, isSuspended: true, createdAt: true },
  });

  const allListings = await prisma.listing.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      host: { select: { name: true, email: true } },
    },
  });

  res.json({
    totalPlatformRevenue,
    totalGrossVolume,
    totalBookings: allBookings.length,
    totalUsers,
    totalHosts,
    totalListings,
    recentUsers,
    allListings,
  });
});


app.post("/admin/users/:id/suspend", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id as string } });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isSuspended: !user.isSuspended },
  });

  res.json(updated);
});

app.post("/admin/listings/:id/moderate", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id as string } });

  if (!listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: { isActive: !listing.isActive },
  });

  res.json(updated);
});


app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Something went wrong" : err.message,
  });
});

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      process.env.FRONTEND_URL || "",
    ].filter(Boolean),
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Not logged in"));
  }

  try {
    const payload = jwt.verify(token, process.env.AUTH_SECRET!) as {
      id: string;
      role: string;
    };
    socket.data.userId = payload.id;
    socket.data.userRole = payload.role;
    next();
  } catch (err) {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  console.log(`User ${socket.data.userId} connected via socket`);
  socket.join(`user:${socket.data.userId}`);

  socket.on("join-conversation", (conversationId: string) => {
    socket.join(conversationId);
  });

  socket.on("join-listing", (listingId: string) => {
    socket.join(`listing:${listingId}`);
  });

  socket.on("send-message", async (data: { conversationId: string; content: string }) => {
    const message = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: socket.data.userId,
        content: data.content,
      },
    });

    io.to(data.conversationId).emit("new-message", message);

    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });

    if (conversation) {
      const recipientId =
        conversation.guestId === socket.data.userId ? conversation.hostId : conversation.guestId;

      await sendNotification(
        recipientId,
        "NEW_MESSAGE",
        "New message",
        data.content.slice(0, 100),
        `/listings/${conversation.listingId}`
      );
    }
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.data.userId} disconnected`);
  });
});


async function sendNotification(userId: string, type: string, title: string, body: string, link?: string) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, link },
  });

  io.to(`user:${userId}`).emit("new-notification", notification);
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await resend.emails.send({
      from: "RentalHub <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

httpServer.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});