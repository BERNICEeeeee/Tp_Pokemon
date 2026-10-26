import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("La variable d'environnement DATABASE_URL est obligatoire.");
}

const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });
