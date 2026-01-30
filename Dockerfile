# Build stage
FROM golang:1.22-alpine3.19 AS builder

WORKDIR /build

# Install build dependencies (only in builder, won't be in final image)
RUN apk add --no-cache gcc musl-dev

# Copy go mod files first for caching
COPY api/go.mod ./
COPY api/go.sum ./
RUN go mod download

# Copy source code
COPY api/*.go ./
COPY api/static ./static/

# Ensure go.mod/go.sum are up to date
RUN go mod tidy

# Build for ARM64 (Raspberry Pi) with optimizations
RUN CGO_ENABLED=1 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o aatm-api .

# Runtime stage
FROM debian:bookworm-slim

# Install all dependencies in a single RUN command to minimize layers
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    mediainfo \
    qbittorrent-nox \
    supervisor \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

# Copy binary
COPY --from=builder /build/aatm-api .

# Create directories
RUN mkdir -p /data /config/qBittorrent /downloads

# Copy supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy qBittorrent default config
COPY qBittorrent.conf /config/qBittorrent/qBittorrent.conf

# Expose ports (API + qBittorrent WebUI)
EXPOSE 8080 8081

# Environment variables
ENV PORT=8080
ENV DATA_DIR=/data
ENV QBT_WEBUI_PORT=8081

# Run supervisor (manages both services)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
