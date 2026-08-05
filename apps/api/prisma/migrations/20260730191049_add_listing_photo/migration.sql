/*
  Warnings:

  - You are about to drop the column `stayRange` on the `Booking` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "stayRange";

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "photoUrl" TEXT;
