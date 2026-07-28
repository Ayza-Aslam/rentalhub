# RentalHub — Project Context

## What this project is
Full-stack rental/booking marketplace (Airbnb-style) — for hands-on learning.

## Tech stack
TypeScript everywhere. Next.js (App Router) frontend, Express backend,
PostgreSQL + Prisma, Stripe (Connect) for payments, Socket.io for realtime,
Turborepo + pnpm monorepo, custom Tailwind components (no UI library).

## Current status
- Phase 0 (monorepo setup): DONE
- Phase 1 (data modeling / Prisma schema): DONE
  - Models done: User, Listing, Booking (with Role and BookingStatus enums)
  - Migration run and confirmed against real Neon database (4 migrations applied: init, add_listing, add_booking, no_double_booking)
  - Double-booking exclusion constraint (Postgres `daterange` + `EXCLUDE USING gist` on Booking.stayRange) already added and live — this was originally planned for Phase 4, so Phase 4 can SKIP re-adding it
  - NOT yet added: Payment, Message, Review, Notification models (to be added progressively as their phases need them)
- Phase 2 onward: NOT STARTED

## How I want you to work with me
Explain every step in simple, plain language, like teaching a beginner.
Explain the "why" behind each step, not just the command. Go one step at
a time, wait for me to confirm before moving to the next.


## RentalHub — Project Context & Roadmap
What this project is

Full-stack rental/booking marketplace (Airbnb-style) — for hands-on learning practice. 3 roles: Guest, Host, Admin.

Tech stack
TypeScript everywhere (frontend, backend, shared)
Next.js (App Router) frontend, Tailwind CSS, custom-built components (no UI library)
Express backend (Node.js)
PostgreSQL + Prisma ORM
Stripe + Stripe Connect for payments
Socket.io for realtime (chat, notifications, live availability)
Turborepo + pnpm monorepo (apps/web, apps/api, packages/shared)
NextAuth.js for auth
Cloudinary/S3 for file storage
Deployment: Vercel (web) + Railway/Render (api) + Neon/Supabase (Postgres)
How I want you to work with me

Explain every step in simple, plain language, like teaching a beginner. Use analogies where helpful. Explain the "why" behind each step and what would break without it. Go one step at a time, wait for my confirmation before moving to the next step. Don't dump multiple steps at once.

FULL PHASE ROADMAP
Phase 0 — Setup & Architecture

Monorepo (Turborepo + pnpm), Next.js app, Express app, shared Zod/types package, Prisma connected to hosted Postgres. Confirm pnpm dev runs everything together. STATUS: DONE

Phase 1 — Data Modeling / Prisma Schema

Define database models: User, Listing, Booking. Run first migration to create real tables. STATUS: DONE. Schema has User, Listing, Booking + Role/BookingStatus enums. 4 migrations applied and confirmed against the live Neon database. The Postgres daterange + EXCLUDE USING gist double-booking constraint (originally slated for Phase 4) is already live on the Booking table — Phase 4 should skip re-adding it and just build the booking logic on top of it. Payment/Message/Review/Notification models still NOT yet added — to be added progressively as their respective phases need them.

Phase 2 — Auth & Roles

NextAuth.js setup, User model role-based access (guest/host/admin), protected routes, basic profile page. STATUS: NOT STARTED

Phase 3 — Listings CRUD + Search

Host listing creation (multi-step form, Zod-validated), public search page with filters (location, price, dates, guests), map view, listing detail page. STATUS: NOT STARTED

Phase 4 — Booking Engine (core hard part)

Add daterange + EXCLUDE USING gist constraint to prevent double-booking. Transactional booking creation, availability check endpoint, pricing calculation. Test with concurrent requests. STATUS: NOT STARTED

Phase 5 — Stripe Payments

Basic Checkout/PaymentIntent flow → Stripe Connect host onboarding + automatic payment splitting → refunds/cancellation policy logic. All webhooks must be idempotent. STATUS: NOT STARTED

Phase 6 — Realtime Layer

Socket.io server (JWT-authenticated) attached to Express. Host-guest chat per booking, realtime notifications (persisted in Notification table), live availability updates on the calendar. STATUS: NOT STARTED

Phase 7 — Reviews

Review allowed only after checkout date passes and status is COMPLETED (node-cron job flips status). Aggregate rating on listing. STATUS: NOT STARTED

Phase 8 — Dashboards

Host dashboard (earnings, bookings, payout status, calendar). Admin dashboard (revenue analytics, disputes, moderation) using Recharts. STATUS: NOT STARTED

Phase 9 — Polish & Deploy

Email notifications (Resend/SendGrid), error/loading/empty states, rate limiting, deploy to Vercel + Railway/Render + Neon/Supabase, write README explaining architecture. STATUS: NOT STARTED

Current Position

Phase 1 is fully DONE — migrations confirmed against the live Neon database, including the double-booking exclusion constraint (originally planned for Phase 4, already live, so that phase can skip it).

Working on: starting Phase 2 (Auth & Roles). Next immediate action: set up NextAuth.js in apps/web, wire it to the existing User model's Role field (guest/host/admin), add protected routes, and a basic profile page.