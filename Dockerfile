# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install build dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

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
# Install build tools, install modules, then remove build tools to keep image small
RUN apk add --no-cache python3 make g++ && \
  npm ci --only=production && \
  apk del python3 make g++ && \
  apk add --no-cache libstdc++

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy public assets
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
# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
