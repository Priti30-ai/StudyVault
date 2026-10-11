# ==========================================
# Stage 1: Build production static bundle
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

# Build-time argument for Vite client API endpoint (defaults to empty for same-origin proxy)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Build the Vite production bundle
RUN npm run build

# ==========================================
# Stage 2: Serve with lightweight Nginx
# ==========================================
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
