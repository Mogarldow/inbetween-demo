// Vytvoří tabulky a nahraje ukázková data: npm run db:setup
import { readFileSync } from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("Chybí DATABASE_URL. Zkopíruj .env.example do .env.local a doplň ji, nebo ji nastav v shellu.");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
for (const file of ["db/schema.sql", "db/seed.sql"]) {
  await client.query(readFileSync(file, "utf8"));
  console.log("Hotovo:", file);
}
await client.end();
