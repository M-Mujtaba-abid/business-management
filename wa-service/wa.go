package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

var (
	ErrNotLinked    = errors.New("no WhatsApp number is linked; scan the QR code in Settings")
	ErrNotOnWA      = errors.New("this number is not on WhatsApp")
	ErrDisconnected = errors.New("WhatsApp is not connected right now")
)

// WA owns the whatsmeow client. After a logout the session is deleted, so the client is rebuilt
// with a fresh device and pairing starts again.
type WA struct {
	ctx       context.Context
	log       zerolog.Logger
	hook      *Webhook
	container *sqlstore.Container

	mu      sync.RWMutex
	cli     *whatsmeow.Client
	qr      string // latest pairing code while not linked
	pairing bool
}

func NewWA(ctx context.Context, cfg Config, hook *Webhook, log zerolog.Logger) (*WA, error) {
	container, err := sqlstore.New(ctx, cfg.DBDialect, cfg.DBAddress, waLog.Zerolog(log.With().Str("mod", "db").Logger()))
	if err != nil {
		return nil, err
	}
	w := &WA{ctx: ctx, log: log, hook: hook, container: container}
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		return nil, err
	}
	w.cli = w.newClient(device)
	return w, nil
}

func (w *WA) newClient(device *store.Device) *whatsmeow.Client {
	cli := whatsmeow.NewClient(device, waLog.Zerolog(w.log.With().Str("mod", "client").Logger()))
	cli.AddEventHandler(w.handleEvent)
	return cli
}

func (w *WA) client() *whatsmeow.Client {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.cli
}

// Start connects with the saved session, or starts QR pairing when there is none.
func (w *WA) Start() error {
	cli := w.client()
	if cli.Store.ID == nil {
		go w.pairLoop()
		return nil
	}
	return cli.Connect()
}

// pairLoop keeps a fresh QR code available until a phone scans it. Each QR channel lasts a few
// minutes; when it times out we simply start a new one.
func (w *WA) pairLoop() {
	w.mu.Lock()
	if w.pairing {
		w.mu.Unlock()
		return
	}
	w.pairing = true
	w.mu.Unlock()
	defer func() {
		w.mu.Lock()
		w.pairing = false
		w.qr = ""
		w.mu.Unlock()
	}()

	for w.ctx.Err() == nil {
		cli := w.client()
		if cli.Store.ID != nil {
			return
		}
		qrChan, err := cli.GetQRChannel(w.ctx)
		if err != nil {
			w.log.Error().Err(err).Msg("Could not start QR pairing")
			sleepCtx(w.ctx, 10*time.Second)
			continue
		}
		if err := cli.Connect(); err != nil {
			w.log.Error().Err(err).Msg("Could not connect for pairing")
			sleepCtx(w.ctx, 10*time.Second)
			continue
		}
		for item := range qrChan {
			switch item.Event {
			case "code":
				w.mu.Lock()
				w.qr = item.Code
				w.mu.Unlock()
				w.log.Info().Msg("New pairing QR code available (Settings → WhatsApp)")
			case "success":
				w.log.Info().Msg("WhatsApp linked successfully")
				return
			default:
				w.mu.Lock()
				w.qr = ""
				w.mu.Unlock()
				if item.Error != nil {
					w.log.Warn().Err(item.Error).Str("event", item.Event).Msg("Pairing ended")
				} else {
					w.log.Info().Str("event", item.Event).Msg("Pairing ended, starting again")
				}
			}
		}
		cli.Disconnect()
		sleepCtx(w.ctx, 3*time.Second)
	}
}

// reset swaps in a brand-new device after the old session was deleted, and starts pairing.
func (w *WA) reset() {
	w.mu.Lock()
	old := w.cli
	w.cli = w.newClient(w.container.NewDevice())
	w.qr = ""
	w.mu.Unlock()
	if old != nil {
		old.Disconnect()
	}
	go w.pairLoop()
}

func (w *WA) Logout(ctx context.Context) error {
	cli := w.client()
	if cli.Store.ID == nil {
		return ErrNotLinked
	}
	if err := cli.Logout(ctx); err != nil {
		// Server unreachable etc.: drop the local session anyway, so a new QR can be scanned
		w.log.Warn().Err(err).Msg("Logout request failed, clearing the local session")
		cli.Disconnect()
		_ = cli.Store.Delete(ctx)
	}
	w.reset()
	return nil
}

type Status struct {
	Connected bool   `json:"connected"`
	LoggedIn  bool   `json:"loggedIn"`
	Phone     string `json:"phone,omitempty"`
	HasQR     bool   `json:"hasQR"`
}

func (w *WA) Status() Status {
	cli := w.client()
	// LoggedIn = a session exists; Connected = it is online right now
	st := Status{Connected: cli.IsConnected() && cli.IsLoggedIn(), LoggedIn: cli.Store.ID != nil}
	if cli.Store.ID != nil {
		st.Phone = cli.Store.ID.User
	}
	w.mu.RLock()
	st.HasQR = w.qr != ""
	w.mu.RUnlock()
	return st
}

func (w *WA) QR() string {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.qr
}

// waitOnline waits a little for a reconnect (network blip) before giving up.
func (w *WA) waitOnline(ctx context.Context, max time.Duration) (*whatsmeow.Client, error) {
	deadline := time.Now().Add(max)
	for {
		cli := w.client()
		if cli.Store.ID == nil {
			return nil, ErrNotLinked
		}
		if cli.IsConnected() && cli.IsLoggedIn() {
			return cli, nil
		}
		if time.Now().After(deadline) {
			return nil, ErrDisconnected
		}
		if !sleepCtx(ctx, 2*time.Second) {
			return nil, ctx.Err()
		}
	}
}

// SendText checks the number is on WhatsApp and sends a plain text message. Returns the message ID.
// recipient waits for the connection and checks that the number is on WhatsApp.
func (w *WA) recipient(ctx context.Context, phone string) (*whatsmeow.Client, types.JID, error) {
	cli, err := w.waitOnline(ctx, 60*time.Second)
	if err != nil {
		return nil, types.JID{}, err
	}
	res, err := cli.IsOnWhatsApp(ctx, []string{"+" + phone})
	if err != nil {
		return nil, types.JID{}, fmt.Errorf("could not check the number: %w", err)
	}
	if len(res) == 0 || !res[0].IsIn {
		return nil, types.JID{}, ErrNotOnWA
	}
	return cli, res[0].JID, nil
}

// SendImage uploads a picture (e.g. an order bill) and sends it with a caption.
func (w *WA) SendImage(ctx context.Context, phone string, data []byte, mime, caption string) (string, error) {
	cli, to, err := w.recipient(ctx, phone)
	if err != nil {
		return "", err
	}
	up, err := cli.Upload(ctx, data, whatsmeow.MediaImage)
	if err != nil {
		return "", fmt.Errorf("could not upload the image: %w", err)
	}
	img := &waE2E.ImageMessage{
		Mimetype:      proto.String(mime),
		URL:           proto.String(up.URL),
		DirectPath:    proto.String(up.DirectPath),
		MediaKey:      up.MediaKey,
		FileEncSHA256: up.FileEncSHA256,
		FileSHA256:    up.FileSHA256,
		FileLength:    proto.Uint64(up.FileLength),
	}
	if caption != "" {
		img.Caption = proto.String(caption)
	}
	resp, err := cli.SendMessage(ctx, to, &waE2E.Message{ImageMessage: img})
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}

func (w *WA) SendText(ctx context.Context, phone, text string) (string, error) {
	cli, to, err := w.recipient(ctx, phone)
	if err != nil {
		return "", err
	}

	// Look like a person: "typing…" for a moment before the message
	_ = cli.SendChatPresence(ctx, to, types.ChatPresenceComposing, types.ChatPresenceMediaText)
	sleepCtx(ctx, typingDelay(text))
	_ = cli.SendChatPresence(ctx, to, types.ChatPresencePaused, types.ChatPresenceMediaText)

	resp, err := cli.SendMessage(ctx, to, &waE2E.Message{Conversation: &text})
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}

func (w *WA) handleEvent(evt interface{}) {
	switch e := evt.(type) {
	case *events.Message:
		w.onMessage(e)
	case *events.Connected:
		w.log.Info().Msg("WhatsApp connected")
	case *events.Disconnected:
		w.log.Warn().Msg("WhatsApp disconnected (auto-reconnecting)")
	case *events.StreamReplaced:
		w.log.Warn().Msg("Session was opened somewhere else with the same credentials")
	case *events.LoggedOut:
		// The phone removed this linked device (or WhatsApp did). The store is deleted by whatsmeow.
		w.log.Warn().Str("reason", e.Reason.String()).Msg("WhatsApp logged out; scan a new QR in Settings")
		go w.reset()
	}
}

// onMessage forwards a customer's direct message to the app (in the background; this handler
// must return quickly).
func (w *WA) onMessage(e *events.Message) {
	info := e.Info
	if info.IsFromMe || info.IsGroup || info.Chat.Server == types.BroadcastServer || info.Chat.Server == types.NewsletterServer {
		return
	}
	text, quotedID := messageText(e.Message)
	if strings.TrimSpace(text) == "" {
		return
	}
	phone := w.senderPhone(info)
	if phone == "" {
		w.log.Warn().Str("sender", info.Sender.String()).Msg("Could not find the phone number of a message sender")
		return
	}
	// Show it as read, like a person would
	cli := w.client()
	go func() { _ = cli.MarkRead(w.ctx, []types.MessageID{info.ID}, info.Timestamp, info.Chat, info.Sender) }()

	w.hook.Send(map[string]any{
		"type":      "message",
		"from":      phone,
		"text":      text,
		"quotedId":  quotedID,
		"messageId": info.ID,
		"timestamp": info.Timestamp.Unix(),
	})
}

// senderPhone returns the sender's phone number. WhatsApp may hide it behind a LID
// (an anonymous ID); then we use the alternative address or the stored LID → phone mapping.
func (w *WA) senderPhone(info types.MessageInfo) string {
	if info.Sender.Server == types.DefaultUserServer {
		return info.Sender.User
	}
	if info.SenderAlt.Server == types.DefaultUserServer {
		return info.SenderAlt.User
	}
	if info.Sender.Server == types.HiddenUserServer {
		pn, err := w.client().Store.LIDs.GetPNForLID(w.ctx, info.Sender)
		if err == nil && !pn.IsEmpty() {
			return pn.User
		}
	}
	return ""
}

// messageText pulls the text (and the ID of the message it replies to, if any) out of a message.
func messageText(m *waE2E.Message) (text, quotedID string) {
	if m == nil {
		return "", ""
	}
	if ext := m.GetExtendedTextMessage(); ext != nil {
		return ext.GetText(), ext.GetContextInfo().GetStanzaID()
	}
	if c := m.GetConversation(); c != "" {
		return c, ""
	}
	// Button / list replies (if a client ever sends them)
	if b := m.GetButtonsResponseMessage(); b != nil {
		return b.GetSelectedDisplayText(), b.GetContextInfo().GetStanzaID()
	}
	if t := m.GetTemplateButtonReplyMessage(); t != nil {
		return t.GetSelectedDisplayText(), t.GetContextInfo().GetStanzaID()
	}
	return "", ""
}

func (w *WA) Close() {
	w.client().Disconnect()
	_ = w.container.Close()
}

// typingDelay: about 1–4 seconds depending on message length
func typingDelay(text string) time.Duration {
	d := time.Duration(len(text)*15) * time.Millisecond
	if d < time.Second {
		d = time.Second
	}
	if d > 4*time.Second {
		d = 4 * time.Second
	}
	return d
}

// sleepCtx sleeps unless the context ends first; returns false if it ended.
func sleepCtx(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}
