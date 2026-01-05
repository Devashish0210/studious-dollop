# Use a minimal Node.js image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Install required system dependencies
RUN apk add --no-cache python3 make g++

# Copy package files first to leverage Docker caching
COPY package.json package-lock.json* ./

# Install dependencies (including dev dependencies for Prisma CLI)
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma Client with correct binary targets
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max_old_space_size=4096"

# Build Next.js application
RUN npm run build --no-lint && ls -la .next

# Remove dev dependencies after build (optional, for smaller image)
RUN npm prune --production

# Expose application port
EXPOSE 3461

# Start the application
CMD ["npm", "start"]
