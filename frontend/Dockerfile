# Frontend Dockerfile — multi-stage production build
# NOTE: Vercel does NOT use this file. It runs `npm run build` directly.
# This Dockerfile is for self-hosted / Docker Compose deployments only.

# Stage 1: build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# SPA routing — all paths serve index.html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n  location /assets/ {\n    expires 1y;\n    add_header Cache-Control "public, immutable";\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
