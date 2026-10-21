/**
 * Cadena de conexión a PostgreSQL. En Docker Compose llega completa en DATABASE_URL. Al ejecutar la API fuera de
 * Docker se arma con las mismas variables POSTGRES_* del .env, apuntando a la base publicada en localhost.
 */
export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { POSTGRES_USER: user, POSTGRES_PASSWORD: password, POSTGRES_DB: db, POSTGRES_HOST: host = "localhost" } = process.env;
  if (!user || !password || !db) {
    throw new Error("Defina DATABASE_URL, o POSTGRES_USER, POSTGRES_PASSWORD y POSTGRES_DB");
  }
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${db}`;
}
