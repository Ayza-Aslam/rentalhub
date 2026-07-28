import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("testpassword123", 10);

  const user = await prisma.user.create({
    data: {
      name: "Salman Test",
      email: "salman@example.com",
      hashedPassword,
      role: "HOST",
    },
  });

   console.log("Created user:", user);
 }

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());



  