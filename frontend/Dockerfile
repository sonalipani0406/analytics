FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build the Next.js app (static export)
RUN pnpm build

# Serve with a simple HTTP server
RUN npm install -g serve

EXPOSE 3000

# Serve the exported static files from out directory
# Note: Next.js exports to 'out' directory by default, or we serve from dist
CMD ["serve", "-s", "out", "-l", "3000"]
