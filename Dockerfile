# WENKER Router - Dockerfile
# Multi-stage build for smaller image

# Stage 1: Build client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:20-alpine AS server-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY --from=client-builder /app/client/dist ./client/dist

# Stage 3: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S wenker && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G wenker -g wenker wenker

# Copy built artifacts
COPY --from=server-builder --chown=wenker:wenker /app/node_modules ./node_modules
COPY --from=server-builder --chown=wenker:wenker /app/server ./server
COPY --from=server-builder --chown=wenker:wenker /app/client/dist ./client/dist
COPY --from=server-builder --chown=wenker:wenker /app/package.json ./

# Create data directory for persistence
RUN mkdir -p /app/.wenker && chown -R wenker:wenker /app/.wenker

# Switch to non-root user
USER wenker

# Expose port
EXPOSE 3600

# Environment variables
ENV NODE_ENV=production \
    WENKER_HOME=/app/.wenker \
    PORT=3600 \
    HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3600/health || exit 1

# Start server
CMD ["node", "server/index.js"]