package main

import (
	"context"
	"encoding/json"
	"errors"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

var ErrQueueFull = errors.New("the WhatsApp send queue is full, try again shortly")

const (
	PriorityNow    = "now"    // an answer to the customer (their reply, a bill sent by hand): goes any time
	PriorityNormal = "normal" // automatic order updates: daytime only, within the daily limit
)

// A single-choice poll sent after the text
type Poll struct {
	Question string   `json:"question"`
	Options  []string `json:"options"`
}

type Job struct {
	RefID    string    `json:"refId"` // the app's WhatsAppMessage id, echoed back in the webhook
	Phone    string    `json:"phone"` // international digits, e.g. 923001234567
	Text     string    `json:"text"`  // the message, or the caption of Image
	Image    []byte    `json:"image,omitempty"`
	Mime     string    `json:"mime,omitempty"`
	Poll     *Poll     `json:"poll,omitempty"` // sent right after Text (e.g. ✅ Confirm / ❌ Cancel)
	Priority string    `json:"priority"`
	Added    time.Time `json:"added"`
}

// What is kept on disk: waiting jobs, and who was messaged today (for the daily limit)
type queueState struct {
	Jobs     []Job           `json:"jobs"`
	Day      string          `json:"day"` // YYYY-MM-DD on the shop's clock
	Contacts map[string]bool `json:"contacts"`
}

// Queue sends messages one at a time, slowly, like a person would:
//   - a random gap (WA_MIN/MAX_GAP_SECONDS) between any two messages;
//   - automatic messages wait out the night (WA_QUIET_START → WA_QUIET_END);
//   - automatic messages reach at most WA_DAILY_NEW_CHATS different customers a day; the rest
//     wait for the next morning.
//
// Bursts of automated messages to many people are what get numbers banned.
type Queue struct {
	cfg  Config
	wa   *WA
	hook *Webhook
	log  zerolog.Logger

	mu   sync.Mutex
	st   queueState
	wake chan struct{}
	last time.Time // when the last message went out
}

func NewQueue(cfg Config, wa *WA, hook *Webhook, log zerolog.Logger) *Queue {
	q := &Queue{cfg: cfg, wa: wa, hook: hook, log: log, wake: make(chan struct{}, 1)}
	q.st.Contacts = map[string]bool{}
	q.load()
	return q
}

func (q *Queue) now() time.Time { return time.Now().In(q.cfg.Location) }

// ── Pacing rules ──

func (q *Queue) quietAt(t time.Time) bool {
	s, e, h := q.cfg.QuietStart, q.cfg.QuietEnd, t.Hour()
	switch {
	case s == e:
		return false
	case s > e: // over midnight, e.g. 22 → 9
		return h >= s || h < e
	default:
		return h >= s && h < e
	}
}

// The next time automatic messages may go out again (end of quiet hours)
func (q *Queue) nextOpen(t time.Time) time.Time {
	open := time.Date(t.Year(), t.Month(), t.Day(), q.cfg.QuietEnd, 0, 0, 0, t.Location())
	if !open.After(t) {
		open = open.AddDate(0, 0, 1)
	}
	return open
}

// Start of tomorrow, then the next open hour after it (the daily limit resets at midnight)
func (q *Queue) nextDay(t time.Time) time.Time {
	midnight := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location()).AddDate(0, 0, 1)
	if q.quietAt(midnight) {
		return q.nextOpen(midnight)
	}
	return midnight
}

func (q *Queue) rollDay(t time.Time) {
	if d := t.Format("2006-01-02"); d != q.st.Day {
		q.st.Day = d
		q.st.Contacts = map[string]bool{}
	}
}

func (q *Queue) limitReached(phone string) bool {
	return q.cfg.DailyLimit > 0 && !q.st.Contacts[phone] && len(q.st.Contacts) >= q.cfg.DailyLimit
}

// When a job can go out (now, or the moment the night / daily limit ends). Caller holds mu.
func (q *Queue) readyAt(j Job, t time.Time) time.Time {
	if j.Priority == PriorityNow {
		return t
	}
	if q.quietAt(t) {
		return q.nextOpen(t)
	}
	if q.limitReached(j.Phone) {
		return q.nextDay(t)
	}
	return t
}

// ── Adding ──

// Add queues a job and returns when it is expected to go out (zero = right away).
// Sending the same refId again replaces the waiting job, so a Resend never sends twice.
func (q *Queue) Add(j Job) (time.Time, error) {
	if j.Priority != PriorityNow {
		j.Priority = PriorityNormal
	}
	j.Added = time.Now()

	q.mu.Lock()
	t := q.now()
	q.rollDay(t)
	replaced := false
	for i := range q.st.Jobs {
		if q.st.Jobs[i].RefID == j.RefID {
			q.st.Jobs[i] = j
			replaced = true
			break
		}
	}
	if !replaced {
		if len(q.st.Jobs) >= q.cfg.QueueSize {
			q.mu.Unlock()
			return time.Time{}, ErrQueueFull
		}
		q.st.Jobs = append(q.st.Jobs, j)
	}
	at := q.readyAt(j, t)
	q.saveLocked()
	q.mu.Unlock()

	q.signal()
	if at.After(t) {
		return at, nil
	}
	return time.Time{}, nil
}

func (q *Queue) signal() {
	select {
	case q.wake <- struct{}{}:
	default:
	}
}

func (q *Queue) Len() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.st.Jobs)
}

// Stats for /status
func (q *Queue) Stats() map[string]any {
	q.mu.Lock()
	defer q.mu.Unlock()
	t := q.now()
	q.rollDay(t)
	return map[string]any{
		"queue":      len(q.st.Jobs),
		"todayChats": len(q.st.Contacts),
		"dailyLimit": q.cfg.DailyLimit,
		"quietNow":   q.quietAt(t),
		"quietStart": q.cfg.QuietStart,
		"quietEnd":   q.cfg.QuietEnd,
	}
}

// ── Sending ──

// next picks the job to send now, or says how long to wait. "now" jobs go first.
func (q *Queue) next() (Job, bool, time.Duration) {
	q.mu.Lock()
	defer q.mu.Unlock()
	t := q.now()
	q.rollDay(t)
	if len(q.st.Jobs) == 0 {
		return Job{}, false, time.Hour
	}
	for _, j := range q.st.Jobs {
		if j.Priority == PriorityNow {
			return j, true, 0
		}
	}
	wait := time.Duration(-1)
	for _, j := range q.st.Jobs {
		at := q.readyAt(j, t)
		if !at.After(t) {
			return j, true, 0
		}
		if d := at.Sub(t); wait < 0 || d < wait {
			wait = d
		}
	}
	return Job{}, false, wait
}

func (q *Queue) Run(ctx context.Context) {
	for {
		// Anti-ban gap since the previous message (whatever comes next)
		gap := q.cfg.MinGap
		if q.cfg.MaxGap > q.cfg.MinGap {
			gap += time.Duration(rand.Int63n(int64(q.cfg.MaxGap - q.cfg.MinGap)))
		}
		if wait := time.Until(q.last.Add(gap)); wait > 0 {
			if !sleepCtx(ctx, wait) {
				return
			}
		}

		j, ok, wait := q.next()
		if !ok {
			if wait > time.Hour {
				wait = time.Hour
			}
			timer := time.NewTimer(wait + time.Second)
			select {
			case <-ctx.Done():
				timer.Stop()
				return
			case <-q.wake:
			case <-timer.C:
			}
			timer.Stop()
			continue
		}

		q.process(ctx, j)
		q.last = time.Now()

		q.mu.Lock()
		for i := range q.st.Jobs {
			// the same job (a Resend while sending replaces it with a newer one: keep that)
			if q.st.Jobs[i].RefID == j.RefID && q.st.Jobs[i].Added.Equal(j.Added) {
				q.st.Jobs = append(q.st.Jobs[:i], q.st.Jobs[i+1:]...)
				break
			}
		}
		q.rollDay(q.now())
		q.st.Contacts[j.Phone] = true
		q.saveLocked()
		q.mu.Unlock()
	}
}

func (q *Queue) process(ctx context.Context, j Job) {
	sendCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	var id string
	var err error
	if len(j.Image) > 0 {
		id, err = q.wa.SendImage(sendCtx, j.Phone, j.Image, j.Mime, j.Text)
	} else {
		id, err = q.wa.SendText(sendCtx, j.Phone, j.Text)
	}
	if err != nil {
		q.log.Warn().Err(err).Str("ref", j.RefID).Str("phone", maskPhone(j.Phone)).Msg("Message not sent")
		q.hook.Send(map[string]any{"type": "failed", "refId": j.RefID, "error": err.Error()})
		return
	}
	q.log.Info().Str("ref", j.RefID).Str("phone", maskPhone(j.Phone)).Str("id", id).Str("priority", j.Priority).Msg("Message sent")
	event := map[string]any{"type": "sent", "refId": j.RefID, "messageId": id}

	// The poll goes a moment after the text, like a person sending a second message
	if j.Poll != nil {
		sleepCtx(sendCtx, 2*time.Second+time.Duration(rand.Int63n(int64(2*time.Second))))
		pollID, perr := q.wa.SendPoll(sendCtx, j.Phone, j.RefID, j.Poll.Question, j.Poll.Options)
		if perr != nil {
			// The text did go out; the customer can still answer by typing 1 / 2
			q.log.Warn().Err(perr).Str("ref", j.RefID).Msg("Poll not sent")
			event["pollError"] = perr.Error()
		} else {
			event["poll"] = map[string]any{"id": pollID, "question": j.Poll.Question, "options": j.Poll.Options}
		}
	}
	q.hook.Send(event)
}

// ── Disk ──

func (q *Queue) load() {
	if q.cfg.QueueFile == "" {
		return
	}
	data, err := os.ReadFile(q.cfg.QueueFile)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			q.log.Warn().Err(err).Msg("Could not read the saved queue")
		}
		return
	}
	var st queueState
	if err := json.Unmarshal(data, &st); err != nil {
		q.log.Warn().Err(err).Msg("Saved queue is damaged; starting empty")
		return
	}
	if st.Contacts == nil {
		st.Contacts = map[string]bool{}
	}
	q.st = st
	if n := len(st.Jobs); n > 0 {
		q.log.Info().Int("jobs", n).Msg("Restored waiting messages")
	}
}

// saveLocked writes the queue atomically (temp file + rename). Caller holds mu.
func (q *Queue) saveLocked() {
	if q.cfg.QueueFile == "" {
		return
	}
	data, err := json.Marshal(q.st)
	if err != nil {
		q.log.Error().Err(err).Msg("Could not save the queue")
		return
	}
	tmp := q.cfg.QueueFile + ".tmp"
	if err := os.MkdirAll(filepath.Dir(q.cfg.QueueFile), 0o755); err == nil {
		err = os.WriteFile(tmp, data, 0o600)
		if err == nil {
			err = os.Rename(tmp, q.cfg.QueueFile)
		}
		if err != nil {
			q.log.Error().Err(err).Msg("Could not save the queue")
		}
	}
}

// 923001234567 → 92300****567 (keep customer numbers out of logs)
func maskPhone(p string) string {
	if len(p) < 8 {
		return "****"
	}
	return p[:5] + "****" + p[len(p)-3:]
}
