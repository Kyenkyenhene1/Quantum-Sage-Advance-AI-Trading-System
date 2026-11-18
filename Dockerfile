# Production-ready Dockerfile for Next.js app
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production --silent

FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci --silent
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# If using Next.js server, expose 3000
EXPOSE 3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/docker/healthcheck.sh ./docker/healthcheck.sh
RUN chmod +x ./docker/healthcheck.sh || true

CMD ["node", ".next/standalone/server.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["sh","/app/docker/healthcheck.sh"]
