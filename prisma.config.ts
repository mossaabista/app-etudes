import { defineConfig } from "prisma/config";
import path from "node:path";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {
  try {
    process.loadEnvFile(path.resolve(process.cwd(), ".env"));
  } catch {
    // Variables must already be in the environment (e.g. Vercel)
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
