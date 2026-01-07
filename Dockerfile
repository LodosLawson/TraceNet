# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy frontend package files (Crucial for postinstall)
COPY frontend/package*.json ./frontend/

# Install dependencies (Root + Frontend via postinstall)
# We trust the postinstall script now because we copied the frontend package.json
RUN npm ci

# Copy all source code (backend and frontend)
COPY . .

# Build Backend
RUN npm run build

# Build Frontend
# We manually run the frontend build here to ensure assets are generated
RUN cd frontend && npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files again for production install
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies (Production only)
# Use --ignore-scripts to avoid `postinstall` (we don't need frontend node_modules in prod)
# We explicitely rebuild native modules
RUN npm ci --only=production --ignore-scripts && \
  npm rebuild && \
  apk add --no-cache libstdc++

# Copy Backend Build
COPY --from=builder /app/dist ./dist

# Copy Frontend Build (The Assets)
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy public folder if needed (fallback)
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
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
