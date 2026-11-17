package main

import (
	"crypto/sha256"
	"path/filepath"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"google.golang.org/protobuf/proto"
)

func TestMessageText(t *testing.T) {
	plain := &waE2E.Message{Conversation: proto.String("1")}
	if text, q := messageText(plain); text != "1" || q != "" {
		t.Fatalf("plain: got %q %q", text, q)
	}

	// Swipe-to-reply on our confirm message carries the quoted message ID
	quoted := &waE2E.Message{ExtendedTextMessage: &waE2E.ExtendedTextMessage{
		Text:        proto.String("2"),
		ContextInfo: &waE2E.ContextInfo{StanzaID: proto.String("3EB0ABC")},
	}}
	if text, q := messageText(quoted); text != "2" || q != "3EB0ABC" {
		t.Fatalf("quoted: got %q %q", text, q)
	}

	if text, _ := messageText(nil); text != "" {
		t.Fatalf("nil: got %q", text)
	}
}

func TestMaskPhone(t *testing.T) {
	if got := maskPhone("923001234567"); got != "92300****567" {
		t.Fatalf("got %q", got)
	}
	if got := maskPhone("123"); got != "****" {
		t.Fatalf("got %q", got)
	}
}

// Must match verifySignature() in lib/whatsapp.ts
func TestWebhookSignature(t *testing.T) {
	h := NewWebhook("http://x", "secret-secret-secret", zerolog.Nop())
	got := h.sign([]byte(`{"a":1}`))
	// computed with Node: crypto.createHmac('sha256', secret).update(body).digest('hex')
	want := "sha256=82d8fbc14179b3a6195dbb654369004c798faa3831fa7ff308b1e2c8aa9498db"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestTypingDelay(t *testing.T) {
	if d := typingDelay("hi"); d != time.Second {
		t.Fatalf("short: %v", d)
	}
	if d := typingDelay(string(make([]byte, 1000))); d != 4*time.Second {
		t.Fatalf("long: %v", d)
	}
}

func testQueue(t *testing.T, limit int) *Queue {
	t.Helper()
	loc, err := time.LoadLocation("Asia/Karachi")
	if err != nil {
		t.Fatal(err)
	}
	cfg := Config{QueueSize: 10, Location: loc, QuietStart: 22, QuietEnd: 9, DailyLimit: limit}
	return NewQueue(cfg, nil, nil, zerolog.Nop())
}

func TestQuietHours(t *testing.T) {
	q := testQueue(t, 0)
	at := func(h int) time.Time { return time.Date(2026, 11, 16, h, 30, 0, 0, q.cfg.Location) }
	for h, want := range map[int]bool{8: true, 9: false, 14: false, 21: false, 22: true, 23: true, 0: true} {
		if got := q.quietAt(at(h)); got != want {
			t.Errorf("quietAt(%d:30) = %v, want %v", h, got, want)
		}
	}
	if open := q.nextOpen(at(23)); open.Day() != 17 || open.Hour() != 9 {
		t.Errorf("nextOpen(23:30) = %v, want 17th 09:00", open)
	}
	if open := q.nextOpen(at(2)); open.Day() != 16 || open.Hour() != 9 {
		t.Errorf("nextOpen(02:30) = %v, want 16th 09:00", open)
	}
}

func TestReadyAt(t *testing.T) {
	q := testQueue(t, 2)
	noon := time.Date(2026, 11, 16, 12, 0, 0, 0, q.cfg.Location)
	night := time.Date(2026, 11, 16, 23, 0, 0, 0, q.cfg.Location)
	q.rollDay(noon)

	normal := Job{Phone: "923000000001", Priority: PriorityNormal}
	now := Job{Phone: "923000000001", Priority: PriorityNow}
	if got := q.readyAt(normal, noon); !got.Equal(noon) {
		t.Errorf("normal at noon should go now, got %v", got)
	}
	if got := q.readyAt(normal, night); got.Hour() != 9 {
		t.Errorf("normal at night should wait for 9:00, got %v", got)
	}
	if got := q.readyAt(now, night); !got.Equal(night) {
		t.Errorf("a reply should go at night, got %v", got)
	}

	// daily limit: 2 different customers, then new ones wait for tomorrow; known ones still go
	q.st.Contacts["923000000001"] = true
	q.st.Contacts["923000000002"] = true
	if got := q.readyAt(Job{Phone: "923000000003"}, noon); got.Day() != 17 || got.Hour() != 9 {
		t.Errorf("3rd new customer should wait for tomorrow 9:00, got %v", got)
	}
	if got := q.readyAt(Job{Phone: "923000000002"}, noon); !got.Equal(noon) {
		t.Errorf("a customer already messaged today should not be limited, got %v", got)
	}
}

func TestAddReplacesSameRef(t *testing.T) {
	q := testQueue(t, 0)
	if _, err := q.Add(Job{RefID: "a", Phone: "923000000001", Text: "one"}); err != nil {
		t.Fatal(err)
	}
	if _, err := q.Add(Job{RefID: "a", Phone: "923000000001", Text: "two"}); err != nil {
		t.Fatal(err)
	}
	if q.Len() != 1 || q.st.Jobs[0].Text != "two" {
		t.Fatalf("a resend must replace the waiting job, got %d jobs", q.Len())
	}
}

func TestPickedOption(t *testing.T) {
	opts := []string{"✅ Confirm", "❌ Cancel"}
	hash := func(s string) []byte { h := sha256.Sum256([]byte(s)); return h[:] }
	if got := pickedOption(opts, [][]byte{hash("❌ Cancel")}); got != 1 {
		t.Fatalf("cancel: got %d", got)
	}
	if got := pickedOption(opts, [][]byte{hash("✅ Confirm")}); got != 0 {
		t.Fatalf("confirm: got %d", got)
	}
	if got := pickedOption(opts, nil); got != -1 {
		t.Fatalf("no vote: got %d", got)
	}
}

func TestCheckPoll(t *testing.T) {
	ok := &Poll{Question: " Order #1 confirm? ", Options: []string{" ✅ Confirm", "❌ Cancel "}}
	if msg := checkPoll(ok); msg != "" || ok.Options[0] != "✅ Confirm" || ok.Question != "Order #1 confirm?" {
		t.Fatalf("valid poll rejected or not trimmed: %q %+v", msg, ok)
	}
	for _, bad := range []*Poll{
		{Question: "", Options: []string{"a", "b"}},
		{Question: "q", Options: []string{"a"}},
		{Question: "q", Options: []string{"a", "a"}},
	} {
		if checkPoll(bad) == "" {
			t.Fatalf("bad poll accepted: %+v", bad)
		}
	}
}

func TestPollStorePersists(t *testing.T) {
	file := filepath.Join(t.TempDir(), "polls.json")
	s := NewPollStore(file, zerolog.Nop())
	s.Add("MSG1", "ref-1", []string{"✅ Confirm", "❌ Cancel"})
	again := NewPollStore(file, zerolog.Nop())
	p, ok := again.Get("MSG1")
	if !ok || p.RefID != "ref-1" || len(p.Options) != 2 {
		t.Fatalf("poll not restored: %+v %v", p, ok)
	}
}
