# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Install pnpm
RUN npm install -g pnpm

COPY frontend/package.json frontend/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY frontend/ .

# Build Next.js static export
RUN pnpm build

# Stage 2: Build and run backend
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

# Install system dependencies for building Python packages
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Copy frontend static files from builder stage
COPY --from=frontend-builder /frontend/out ./static_frontend

# Expose port (default 5000)
EXPOSE 5000

# Run the application
CMD ["python", "app.py"]
