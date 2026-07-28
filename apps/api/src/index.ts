import "dotenv/config";
import express from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "./middleware/auth";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 4000;

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
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

app.post("/auth/signup", async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});