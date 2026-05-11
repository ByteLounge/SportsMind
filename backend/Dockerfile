# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy lockfile and package.json
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDeps for build)
RUN pnpm install --frozen-lockfile

# Copy source and config
COPY . .

# Build the project
RUN pnpm run build

# Production stage
FROM node:20-slim

# Set environment to production
ENV NODE_ENV=production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy built assets and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Railway uses the PORT environment variable
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
