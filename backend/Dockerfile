# Use official Node 20 slim image for a secure, lightweight production environment
FROM node:20-slim AS base

# Set working directory
WORKDIR /usr/src/app

# Copy package configurations first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies only and clean npm cache to keep image small
RUN npm ci --omit=dev && npm cache clean --force

# Copy the remaining application source files
COPY . .

# Switch to the secure non-root user
USER node

# Expose the port (Render will route traffic to this port)
EXPOSE 5000

# Set production environment defaults
ENV PORT=5000
ENV NODE_ENV=production

# Run the backend server
CMD ["node", "server.js"]
