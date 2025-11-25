# Multi-stage Dockerfile for TraceNet Blockchain Node

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && \
  npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy public directory for static files
COPY public ./public

# Create data directory for blockchain storage
RUN mkdir -p /app/data

# Create non-root user
RUN addgroup -g 1001 -S blockchain && \
  adduser -S -u 1001 -G blockchain blockchain && \
  chown -R blockchain:blockchain /app

# Switch to non-root user
USER blockchain

# Expose ports
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
