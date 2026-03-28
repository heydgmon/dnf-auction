# ── Build stage ──
FROM node:20-alpine AS builder
WORKDIR /app

ARG CACHEBUST=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN rm -rf .next && npm run build

# ── Production stage ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 3000

CMD ["node", "server.js"]