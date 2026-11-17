package main

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// A poll we sent (e.g. "Order #1045 confirm karein?  ✅ Confirm / ❌ Cancel").
// A vote only carries SHA-256 hashes of the chosen options, so we keep the option names to
// turn the hashes back into an answer, and the refId to tell the app which order it is about.
type sentPoll struct {
	RefID   string    `json:"refId"`
	Options []string  `json:"options"`
	Sent    time.Time `json:"sent"`
}

const (
	pollKeep    = 60 * 24 * time.Hour // votes on older polls are no longer matched to an order
	pollMaxKept = 5000
)

// PollStore remembers the polls we sent, on disk next to the queue (survives restarts).
type PollStore struct {
	file string
	log  zerolog.Logger

	mu    sync.Mutex
	polls map[string]sentPoll // WhatsApp message id → poll
}

func NewPollStore(file string, log zerolog.Logger) *PollStore {
	s := &PollStore{file: file, log: log, polls: map[string]sentPoll{}}
	s.load()
	return s
}

func (s *PollStore) Add(messageID, refID string, options []string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.polls[messageID] = sentPoll{RefID: refID, Options: options, Sent: time.Now()}
	s.pruneLocked()
	s.saveLocked()
}

func (s *PollStore) Get(messageID string) (sentPoll, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.polls[messageID]
	return p, ok
}

// pickedOption: which option the voter chose (-1 = none, i.e. they took their vote back)
func pickedOption(options []string, selected [][]byte) int {
	for _, sel := range selected {
		for i, name := range options {
			h := sha256.Sum256([]byte(name))
			if string(h[:]) == string(sel) {
				return i
			}
		}
	}
	return -1
}

func (s *PollStore) pruneLocked() {
	cutoff := time.Now().Add(-pollKeep)
	for id, p := range s.polls {
		if p.Sent.Before(cutoff) {
			delete(s.polls, id)
		}
	}
	for len(s.polls) > pollMaxKept {
		oldest, at := "", time.Now()
		for id, p := range s.polls {
			if p.Sent.Before(at) {
				oldest, at = id, p.Sent
			}
		}
		delete(s.polls, oldest)
	}
}

func (s *PollStore) load() {
	if s.file == "" {
		return
	}
	data, err := os.ReadFile(s.file)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			s.log.Warn().Err(err).Msg("Could not read the saved polls")
		}
		return
	}
	if err := json.Unmarshal(data, &s.polls); err != nil || s.polls == nil {
		s.log.Warn().Err(err).Msg("Saved polls are damaged; starting empty")
		s.polls = map[string]sentPoll{}
	}
}

func (s *PollStore) saveLocked() {
	if s.file == "" {
		return
	}
	data, err := json.Marshal(s.polls)
	if err == nil {
		if err = os.MkdirAll(filepath.Dir(s.file), 0o755); err == nil {
			tmp := s.file + ".tmp"
			if err = os.WriteFile(tmp, data, 0o600); err == nil {
				err = os.Rename(tmp, s.file)
			}
		}
	}
	if err != nil {
		s.log.Error().Err(err).Msg("Could not save the polls")
	}
}
