# ── Build stage ──
FROM node:18-alpine AS builder
WORKDIR /app

# 캐시 무효화용 ARG
ARG CACHEBUST=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# .next 캐시 완전 제거 후 빌드
RUN rm -rf .next && npm run build

# ── Production stage ──
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]