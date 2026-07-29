# Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma/ ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build

# Runner
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl && addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
RUN chown -R app:app /app
EXPOSE 3001
USER app
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl --fail http://localhost:3001/api/health || exit 1
CMD ["node", "dist/src/index.js"]
