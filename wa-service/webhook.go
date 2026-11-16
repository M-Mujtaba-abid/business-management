package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// Webhook POSTs events to the app, signed with HMAC-SHA256 (header X-WA-Signature: sha256=<hex>),
// retrying with backoff when the app is down or answers 5xx.
type Webhook struct {
	url    string
	secret []byte
	client *http.Client
	log    zerolog.Logger
	wg     sync.WaitGroup
}

func NewWebhook(url, secret string, log zerolog.Logger) *Webhook {
	return &Webhook{url: url, secret: []byte(secret), client: &http.Client{Timeout: 15 * time.Second}, log: log}
}

func (h *Webhook) sign(body []byte) string {
	mac := hmac.New(sha256.New, h.secret)
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// Send delivers the event in the background.
func (h *Webhook) Send(event map[string]any) {
	body, err := json.Marshal(event)
	if err != nil {
		h.log.Error().Err(err).Msg("Could not encode webhook event")
		return
	}
	h.wg.Add(1)
	go func() {
		defer h.wg.Done()
		delays := []time.Duration{0, 2 * time.Second, 10 * time.Second, 30 * time.Second, 2 * time.Minute}
		for i, d := range delays {
			time.Sleep(d)
			retry, err := h.post(body)
			if err == nil {
				return
			}
			h.log.Warn().Err(err).Int("attempt", i+1).Interface("type", event["type"]).Msg("Webhook delivery failed")
			if !retry {
				return
			}
		}
		h.log.Error().Interface("type", event["type"]).Interface("ref", event["refId"]).Msg("Webhook given up")
	}()
}

// post returns (shouldRetry, error)
func (h *Webhook) post(body []byte) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.url, bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-WA-Signature", h.sign(body))
	resp, err := h.client.Do(req)
	if err != nil {
		return true, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return false, nil
	}
	// 4xx (bad signature / bad request) won't get better by retrying
	return resp.StatusCode >= 500 || resp.StatusCode == http.StatusTooManyRequests, fmt.Errorf("app answered %d", resp.StatusCode)
}

// Wait gives in-flight deliveries a moment to finish on shutdown.
func (h *Webhook) Wait(max time.Duration) {
	done := make(chan struct{})
	go func() { h.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(max):
	}
}
