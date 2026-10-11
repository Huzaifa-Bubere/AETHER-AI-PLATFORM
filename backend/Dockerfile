# Backend Dockerfile — production build
FROM node:22-alpine AS builder

WORKDIR /app

# System deps needed by some npm packages (sharp, bcrypt, etc.)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads logs

EXPOSE 5001

# 127.0.0.1, not localhost: inside the container `localhost` resolves to ::1
# while Node binds IPv4, so the probe would report "connection refused" even
# though the server is serving normally.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5001/health || exit 1

CMD ["node", "dist/server.js"]
