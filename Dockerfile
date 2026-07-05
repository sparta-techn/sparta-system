# syntax=docker/dockerfile:1
# SpartaFlow — production image (TanStack Start SSR on Nitro / Node)
# Multi-stage: build with Bun, run the Node server output with a slim Node runtime.
# Business logic is untouched — this only builds and runs the existing app.

######################## 1. Build stage ########################
FROM oven/bun:1-alpine AS build
WORKDIR /app

# VITE_* values are INLINED into the browser bundle at build time, so they must
# be present during `bun run build`. Pass them as build args (see compose).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY} \
    VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID}

# Build the Node server output, NOT the repo's default cloudflare-module preset.
ENV NITRO_PRESET=node-server

# Install deps first for better layer caching.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Build the app → produces ./.output (server/index.mjs + public/)
COPY . .
RUN bun run build

######################## 2. Runtime stage ########################
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Run as an unprivileged user.
RUN addgroup -S app && adduser -S app -G app

# Nitro's node-server output is self-contained (deps are bundled), so we only
# need the .output directory — no node_modules copy required.
COPY --from=build --chown=app:app /app/.output ./.output

USER app
EXPOSE 3000

# Liveness: hit the SSR server on the loopback. Uses Node's global fetch (>=18),
# so no extra tooling is needed in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
