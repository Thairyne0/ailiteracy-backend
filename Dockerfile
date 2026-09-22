# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
# Lockfile generato con npm 11: allineare la versione di npm.
RUN npm install -g npm@11
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM deps AS build
COPY . .
# Prisma 7 risolve DATABASE_URL anche per `generate`: valore fittizio solo in build.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM base AS runner
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=app:app /app/package.json ./package.json
USER app
EXPOSE 4000
# Applica le migrazioni e avvia.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
