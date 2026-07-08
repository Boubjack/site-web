import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL manquant. Créez un projet sur https://neon.tech et copiez la connection string dans vos variables d\'environnement.'
  );
}

export const sql = neon(process.env.DATABASE_URL);
