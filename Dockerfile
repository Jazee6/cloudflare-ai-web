FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json bun.lock ./
RUN npm install -g bun@1.4.4
RUN bun install --no-save --frozen-lockfile

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DEPLOY_TARGET=node
# Optional site address baked into the client build (canonical, share images, sitemap.xml).
ARG SITE_URL
ENV SITE_URL=$SITE_URL
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 app

COPY --from=builder --chown=app:nodejs /app/.output ./.output

USER app

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
