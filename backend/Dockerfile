# ==========================================
# Stage 1: Install production dependencies
# ==========================================
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy dependency specifications
COPY package.json package-lock.json ./

# Install only production dependencies cleanly
RUN npm ci --omit=dev

# ==========================================
# Stage 2: Production runtime image
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set default production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Copy production dependencies from builder stage
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules

# Copy application source code and package metadata
COPY --chown=node:node package.json ./
COPY --chown=node:node src/ ./src/

# Use official non-root user 'node' (UID/GID 1000) for security hardening
USER node

# Expose backend API port
EXPOSE 5000

# Docker healthcheck querying the existing /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5000) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the backend server
CMD ["node", "src/server.js"]
