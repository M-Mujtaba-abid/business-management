// wa-service: a small WhatsApp gateway for the Business Manager app, built on whatsmeow.
//
// It links to one WhatsApp number (scan a QR once, like WhatsApp Web), then:
//   - POST /send    queues a text or picture message to a customer (sent one by one, with a human-like
//     gap; automatic ones wait for daytime and a daily limit, see queue.go)
//   - GET  /status  connection state, linked number, queue size
//   - GET  /qr      the pairing QR as a PNG while no number is linked
//   - POST /logout  unlinks the number
//
// Results ("sent" / "failed") and customers' replies are POSTed to the app's webhook, signed with
// HMAC-SHA256 so the app knows they really came from here.
package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	_ "time/tzdata" // time zones inside the binary (the slim image has none)

	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"github.com/rs/zerolog"
)

type Config struct {
	Port          string
	APISecret     string // Bearer token the app uses to call us
	WebhookURL    string // the app's /api/whatsapp/webhook
	WebhookSecret string // HMAC key for webhook bodies
	DBDialect     string // "sqlite3" (default) or "postgres"
	DBAddress     string
	MinGap        time.Duration // gap between two sent messages (anti-ban)
	MaxGap        time.Duration
	QueueSize     int
	QueueFile     string // pending messages are kept here, so a restart loses none
	PollFile      string // polls we sent (to read the votes on them)

	// Anti-ban pacing for automatic ("normal") messages; replies to a customer go out anyway
	Location   *time.Location // the shop's clock
	QuietStart int            // no automatic messages from this hour…
	QuietEnd   int            // …until this hour (22 → 9 = night). Equal = no quiet hours
	DailyLimit int            // most different customers messaged automatically per day (0 = no limit)
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func envInt(key string, def, min, max int) int {
	n, err := strconv.Atoi(env(key, ""))
	if err != nil || n < min || n > max {
		return def
	}
	return n
}

func envSeconds(key string, def int) time.Duration {
	n, err := strconv.Atoi(env(key, ""))
	if err != nil || n < 0 {
		n = def
	}
	return time.Duration(n) * time.Second
}

func loadConfig() (Config, error) {
	cfg := Config{
		Port:          env("PORT", "8080"),
		APISecret:     env("WA_API_SECRET", ""),
		WebhookURL:    env("WA_WEBHOOK_URL", ""),
		WebhookSecret: env("WA_WEBHOOK_SECRET", ""),
		DBDialect:     env("WA_DB_DIALECT", "sqlite3"),
		DBAddress:     env("WA_DB_ADDRESS", "file:/data/wa.db?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000"),
		MinGap:        envSeconds("WA_MIN_GAP_SECONDS", 20),
		MaxGap:        envSeconds("WA_MAX_GAP_SECONDS", 60),
		QueueSize:     500,
		QueueFile:     env("WA_QUEUE_FILE", "/data/queue.json"),
		PollFile:      env("WA_POLL_FILE", "/data/polls.json"),
		QuietStart:    envInt("WA_QUIET_START", 22, 0, 23),
		QuietEnd:      envInt("WA_QUIET_END", 9, 0, 23),
		DailyLimit:    envInt("WA_DAILY_NEW_CHATS", 150, 0, 100000),
	}
	loc, err := time.LoadLocation(env("WA_TIMEZONE", "Asia/Karachi"))
	if err != nil {
		return cfg, errors.New("WA_TIMEZONE is not a valid time zone (e.g. Asia/Karachi)")
	}
	cfg.Location = loc
	if len(cfg.APISecret) < 16 {
		return cfg, errors.New("WA_API_SECRET must be set (at least 16 characters)")
	}
	if cfg.WebhookURL == "" || len(cfg.WebhookSecret) < 16 {
		return cfg, errors.New("WA_WEBHOOK_URL and WA_WEBHOOK_SECRET (at least 16 characters) must be set")
	}
	if cfg.MaxGap < cfg.MinGap {
		cfg.MaxGap = cfg.MinGap
	}
	return cfg, nil
}

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	log := zerolog.New(os.Stdout).With().Timestamp().Logger()
	if lvl, err := zerolog.ParseLevel(env("LOG_LEVEL", "info")); err == nil {
		zerolog.SetGlobalLevel(lvl)
	}

	cfg, err := loadConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("Bad configuration")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	hook := NewWebhook(cfg.WebhookURL, cfg.WebhookSecret, log.With().Str("mod", "webhook").Logger())
	wa, err := NewWA(ctx, cfg, hook, log.With().Str("mod", "wa").Logger())
	if err != nil {
		log.Fatal().Err(err).Msg("Could not open the WhatsApp session store")
	}
	if err := wa.Start(); err != nil {
		log.Fatal().Err(err).Msg("Could not start WhatsApp")
	}

	queue := NewQueue(cfg, wa, hook, log.With().Str("mod", "queue").Logger())
	go queue.Run(ctx)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           NewServer(cfg, wa, queue, log.With().Str("mod", "http").Logger()),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
	}
	go func() {
		log.Info().Str("port", cfg.Port).Msg("wa-service listening")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal().Err(err).Msg("HTTP server stopped")
		}
	}()

	<-ctx.Done()
	log.Info().Msg("Shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	hook.Wait(5 * time.Second)
	wa.Close()
}
