# ── Build (CGO is needed for SQLite) ──
FROM golang:1.27-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=1 go build -trimpath -ldflags="-s -w" -o /out/wa-service .

# ── Run ──
FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tzdata wget \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --home /data wa \
 && mkdir -p /data && chown wa /data
COPY --from=build /out/wa-service /usr/local/bin/wa-service
USER wa
VOLUME ["/data"]
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["wa-service"]
