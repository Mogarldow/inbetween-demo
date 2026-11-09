/** @type {import('next').NextConfig} */
export default {
  // PGlite (vestavěný Postgres pro lokální běh) nesmí projít bundlerem.
  serverExternalPackages: ["@electric-sql/pglite"],
};
