import 'dotenv/config'; // ← WAJIB agar process.env.DATABASE_URL terbaca
import { defineConfig } from 'prisma/config';

export default defineConfig({
  migrations: {
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },
  generator: {
    provider: 'prisma-client-js',
  },
});
