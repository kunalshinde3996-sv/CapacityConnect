import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

// One shared client for the whole process. Prisma 7 talks to Postgres through
// a "driver adapter" (@prisma/adapter-pg, which uses the standard `pg` driver).
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
