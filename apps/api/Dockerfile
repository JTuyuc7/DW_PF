FROM oven/bun:1.3
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY . .
EXPOSE 4000
# Aplica el esquema, siembra datos demo y arranca el servidor
CMD ["sh", "-c", "bunx drizzle-kit push --force && bun src/db/seed.ts && bun src/index.ts"]
