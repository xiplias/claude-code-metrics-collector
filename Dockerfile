# Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source files
COPY . .

# Build the application
RUN bun run build

# Runtime stage
FROM oven/bun:1-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create directory for database with proper permissions
RUN mkdir -p /data && chown -R bun:bun /data

# Set environment variable for database location
ENV DATABASE_PATH=/data/claude-metrics.db

# Expose port
EXPOSE 3000

# Run as non-root user
USER bun

# Start the server
CMD ["bun", "start"]
