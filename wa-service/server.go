package main

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/rs/zerolog"
	"github.com/skip2/go-qrcode"
)

var phoneRe = regexp.MustCompile(`^\d{11,13}$`)

type Server struct {
	cfg   Config
	wa    *WA
	queue *Queue
	log   zerolog.Logger
}

func NewServer(cfg Config, wa *WA, queue *Queue, log zerolog.Logger) http.Handler {
	s := &Server{cfg: cfg, wa: wa, queue: queue, log: log}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("POST /send", s.auth(s.handleSend))
	mux.HandleFunc("GET /status", s.auth(s.handleStatus))
	mux.HandleFunc("GET /qr", s.auth(s.handleQR))
	mux.HandleFunc("POST /logout", s.auth(s.handleLogout))
	return mux
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	want := []byte("Bearer " + s.cfg.APISecret)
	return func(w http.ResponseWriter, r *http.Request) {
		got := []byte(r.Header.Get("Authorization"))
		if subtle.ConstantTimeCompare(got, want) != 1 {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

// Pictures we accept on /send (sent as an image message, Text becomes its caption)
var imageTypes = map[string]bool{"image/png": true, "image/jpeg": true}

const maxImageBytes = 5 << 20

func (s *Server) handleSend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefID string `json:"refId"`
		Phone string `json:"phone"`
		Text  string `json:"text"`
		Image string `json:"image"` // optional, base64
		Mime  string `json:"mime"`
		// "now" = an answer to the customer (sent any time); otherwise automatic (daytime, daily limit)
		Priority string `json:"priority"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON (or the image is too big)"})
		return
	}
	req.Phone = strings.TrimPrefix(strings.TrimSpace(req.Phone), "+")
	req.Text = strings.TrimSpace(req.Text)

	var image []byte
	if req.Image != "" {
		var err error
		if image, err = base64.StdEncoding.DecodeString(req.Image); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "image must be base64"})
			return
		}
		if !imageTypes[req.Mime] {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "image must be PNG or JPEG"})
			return
		}
		if len(image) > maxImageBytes {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "image is larger than 5 MB"})
			return
		}
	}

	switch {
	case req.RefID == "":
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "refId is required"})
		return
	case !phoneRe.MatchString(req.Phone):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "phone must be international digits, e.g. 923001234567"})
		return
	case image == nil && (req.Text == "" || utf8.RuneCountInString(req.Text) > 4000):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "text must be 1–4000 characters"})
		return
	case image != nil && utf8.RuneCountInString(req.Text) > 1000:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "caption must be at most 1000 characters"})
		return
	}
	if !s.wa.Status().LoggedIn {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": ErrNotLinked.Error()})
		return
	}
	at, err := s.queue.Add(Job{RefID: req.RefID, Phone: req.Phone, Text: req.Text, Image: image, Mime: req.Mime, Priority: req.Priority})
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	resp := map[string]any{"queued": true, "queue": s.queue.Len()}
	if !at.IsZero() {
		resp["scheduledFor"] = at.UTC().Format(time.RFC3339) // held back: night or daily limit
	}
	writeJSON(w, http.StatusAccepted, resp)
}

func (s *Server) handleStatus(w http.ResponseWriter, _ *http.Request) {
	st := s.wa.Status()
	out := s.queue.Stats()
	out["connected"] = st.Connected
	out["loggedIn"] = st.LoggedIn
	out["phone"] = st.Phone
	out["hasQR"] = st.HasQR
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleQR(w http.ResponseWriter, _ *http.Request) {
	code := s.wa.QR()
	if code == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no QR code right now"})
		return
	}
	png, err := qrcode.Encode(code, qrcode.Medium, 512)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not draw QR"})
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(png)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	if err := s.wa.Logout(ctx); err != nil {
		code := http.StatusInternalServerError
		if errors.Is(err, ErrNotLinked) {
			code = http.StatusBadRequest
		}
		writeJSON(w, code, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
