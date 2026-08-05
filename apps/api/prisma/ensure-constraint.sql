DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Booking' AND column_name = 'stayRange'
  ) THEN
    EXECUTE 'ALTER TABLE "Booking" ADD COLUMN "stayRange" daterange GENERATED ALWAYS AS (daterange("checkIn"::date, "checkOut"::date, ''[)'')) STORED';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_bookings'
  ) THEN
    EXECUTE 'ALTER TABLE "Booking" ADD CONSTRAINT no_overlapping_bookings EXCLUDE USING gist ("listingId" WITH =, "stayRange" WITH &&) WHERE (status IN (''PENDING'', ''CONFIRMED''))';
  END IF;
END $$;

