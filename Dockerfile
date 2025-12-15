# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for build
COPY package*.json ./
# Install python/make/g++ for potential native module builds usually needed by bcrypt or similar
RUN apk add --no-cache python3 make g++

RUN npm ci --ignore-scripts

COPY . .

# Build the client and server
RUN npm run build
# Prune dev dependencies
RUN npm prune --production

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Install minimal runtime deps if needed
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=5000

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
# Copy any public or necessary script files if they aren't bundled
# COPY --from=builder /app/public ./public 
# If server/production.ts bundles everything, we might not need node_modules runtime if we bundle deps?
# The package.json script says: --packages=external
# So we DO need node_modules.

EXPOSE 5000

# Use dumb-init to handle signals correctly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "dist/index.js"]
