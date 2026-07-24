# Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runner
FROM nginx:alpine
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R app:app /usr/share/nginx/html /var/cache/nginx /var/run
EXPOSE 80
USER app
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl --fail http://localhost:80 || exit 1
CMD ["nginx", "-g", "daemon off;"]
