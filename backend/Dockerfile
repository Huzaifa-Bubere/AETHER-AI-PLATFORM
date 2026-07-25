# Backend Dockerfile — production build
FROM node:18-alpine

WORKDIR /app

# System deps needed by some npm packages (sharp, bcrypt, etc.)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

RUN mkdir -p uploads logs

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5001/health || exit 1

CMD ["node", "dist/server.js"]
