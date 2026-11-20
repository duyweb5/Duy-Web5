# Stage 1: Build React + Vite production bundle (use glibc slim image for Vite 8 & Tailwind v4 native binaries)
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# Stage 2: Serve static bundle with Nginx (Google Cloud Run ready)
FROM nginx:1.27-alpine

ENV PORT=8080

# Remove default nginx config and install Cloud Run template
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built static files (including /src/assets/images copied by Vite plugin)
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
