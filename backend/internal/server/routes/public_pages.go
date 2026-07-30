package routes

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/pocketbase/pocketbase/core"
	"golang.org/x/net/html"
)

const (
	defaultNoteTitle = "未命名备忘录"
	devIndexURLEnv   = "FASTNOTE_DEV_INDEX_URL"
	maxIndexHTMLSize = 2 << 20
	maxTitleRunes    = 120
	maxSummaryRunes  = 320
)

var errPublicNoteNotFound = errors.New("public note not found")

type publicNotePageData struct {
	Title        string
	Summary      string
	CanonicalURL string
}

type publicPageTemplateLoader struct {
	client     *http.Client
	devURL     string
	staticHTML []byte
}

func WithPublicPages(
	staticFS fs.FS,
	fallback func(*core.RequestEvent) error,
) func(*core.RequestEvent) error {
	templates, err := newPublicPageTemplateLoader(staticFS, os.Getenv(devIndexURLEnv))
	if err != nil {
		log.Printf("public page routes: cannot read frontend index.html: %v", err)
		return fallback
	}

	return func(e *core.RequestEvent) error {
		username, noteID, ok := matchPublicNotePath(e.Request.URL.Path)
		if !ok {
			return fallback(e)
		}

		page, err := findPublicNotePage(e, username, noteID)
		if err != nil {
			if !errors.Is(err, errPublicNoteNotFound) {
				e.App.Logger().Error("failed to render public note snapshot", "error", err)
			}
			if templates.devURL != "" {
				if indexHTML, loadErr := templates.load(e.Request.Context()); loadErr == nil {
					return e.HTML(http.StatusOK, string(indexHTML))
				}
			}
			return fallback(e)
		}

		indexHTML, err := templates.load(e.Request.Context())
		if err != nil {
			e.App.Logger().Error("failed to load frontend index.html", "error", err)
			return fallback(e)
		}

		rendered, err := renderPublicNotePage(indexHTML, page)
		if err != nil {
			e.App.Logger().Error("failed to inject public note snapshot", "error", err)
			return fallback(e)
		}

		e.Response.Header().Set("Cache-Control", "no-store")
		return e.HTML(http.StatusOK, rendered)
	}
}

func newPublicPageTemplateLoader(staticFS fs.FS, devURL string) (*publicPageTemplateLoader, error) {
	loader := &publicPageTemplateLoader{
		client: &http.Client{Timeout: 3 * time.Second},
		devURL: strings.TrimSpace(devURL),
	}

	if staticFS != nil {
		indexHTML, err := fs.ReadFile(staticFS, "index.html")
		if err == nil {
			loader.staticHTML = indexHTML
		} else if loader.devURL == "" {
			return nil, err
		}
	}

	if loader.devURL == "" && len(loader.staticHTML) == 0 {
		return nil, errors.New("no frontend index.html source is configured")
	}

	return loader, nil
}

func (loader *publicPageTemplateLoader) load(ctx context.Context) ([]byte, error) {
	if loader.devURL != "" {
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, loader.devURL, nil)
		if err == nil {
			request.Header.Set("Accept", "text/html")
			response, requestErr := loader.client.Do(request)
			if requestErr == nil {
				defer response.Body.Close()
				if response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices {
					indexHTML, readErr := io.ReadAll(io.LimitReader(response.Body, maxIndexHTMLSize+1))
					if readErr == nil && len(indexHTML) <= maxIndexHTMLSize {
						return indexHTML, nil
					}
				}
			}
		}
	}

	if len(loader.staticHTML) > 0 {
		return loader.staticHTML, nil
	}

	return nil, errors.New("frontend index.html is unavailable")
}

func matchPublicNotePath(path string) (username string, noteID string, ok bool) {
	segments := strings.Split(strings.Trim(path, "/"), "/")
	if len(segments) != 3 ||
		segments[0] == "" ||
		segments[0] == "_" ||
		segments[0] == "api" ||
		segments[1] != "n" ||
		segments[2] == "" {
		return "", "", false
	}
	return segments[0], segments[2], true
}

func findPublicNotePage(e *core.RequestEvent, username string, noteID string) (publicNotePageData, error) {
	user, err := e.App.FindFirstRecordByData("users", "username", username)
	if err != nil {
		return publicNotePageData{}, normalizeLookupError(err)
	}

	note, err := e.App.FindRecordById("notes", noteID)
	if err != nil {
		return publicNotePageData{}, normalizeLookupError(err)
	}
	if !isPublicNoteForUser(note, user.Id) {
		return publicNotePageData{}, errPublicNoteNotFound
	}

	title := truncateText(note.GetString("title"), maxTitleRunes)
	if title == "" {
		title = defaultNoteTitle
	}

	return publicNotePageData{
		Title:        title,
		Summary:      truncateText(note.GetString("summary"), maxSummaryRunes),
		CanonicalURL: buildCanonicalURL(e.App.Settings().Meta.AppURL, username, noteID),
	}, nil
}

func normalizeLookupError(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return errPublicNoteNotFound
	}
	return err
}

func isPublicNoteForUser(note *core.Record, userID string) bool {
	return note.GetString("user_id") == userID &&
		note.GetBool("is_public") &&
		note.GetInt("is_deleted") == 0 &&
		note.GetInt("item_type") == 2
}

func buildCanonicalURL(appURL string, username string, noteID string) string {
	baseURL := strings.TrimRight(strings.TrimSpace(appURL), "/")
	if baseURL == "" {
		return ""
	}

	return fmt.Sprintf(
		"%s/%s/n/%s",
		baseURL,
		url.PathEscape(username),
		url.PathEscape(noteID),
	)
}

func truncateText(value string, maxRunes int) string {
	value = strings.Join(strings.Fields(value), " ")
	if utf8.RuneCountInString(value) <= maxRunes {
		return value
	}

	runes := []rune(value)
	return strings.TrimSpace(string(runes[:maxRunes]))
}

func renderPublicNotePage(indexHTML []byte, page publicNotePageData) (string, error) {
	document, err := html.Parse(bytes.NewReader(indexHTML))
	if err != nil {
		return "", err
	}

	head := findElement(document, "head", "", "")
	app := findElement(document, "div", "id", "app")
	if head == nil || app == nil {
		return "", errors.New("frontend index.html is missing head or #app")
	}

	documentTitle := page.Title + " - fastnote"
	title := findElement(head, "title", "", "")
	if title == nil {
		title = element("title")
		head.AppendChild(title)
	}
	replaceChildren(title, text(documentTitle))

	appendMeta(head, "name", "description", page.Summary)
	appendMeta(head, "property", "og:type", "article")
	appendMeta(head, "property", "og:title", documentTitle)
	appendMeta(head, "property", "og:description", page.Summary)
	if page.CanonicalURL != "" {
		head.AppendChild(element("link",
			html.Attribute{Key: "rel", Val: "canonical"},
			html.Attribute{Key: "href", Val: page.CanonicalURL},
		))
		appendMeta(head, "property", "og:url", page.CanonicalURL)
	}

	article := element("article", html.Attribute{Key: "data-public-note-snapshot", Val: ""})
	article.AppendChild(withText(element("h1"), page.Title))
	if page.Summary != "" {
		article.AppendChild(withText(element("p"), page.Summary))
	}
	main := element("main", html.Attribute{Key: "data-server-rendered", Val: "public-note"})
	main.AppendChild(article)
	replaceChildren(app, main)

	var output bytes.Buffer
	if err := html.Render(&output, document); err != nil {
		return "", err
	}
	return output.String(), nil
}

func findElement(node *html.Node, tag string, attrKey string, attrValue string) *html.Node {
	if node.Type == html.ElementNode && node.Data == tag {
		if attrKey == "" {
			return node
		}
		for _, attr := range node.Attr {
			if attr.Key == attrKey && attr.Val == attrValue {
				return node
			}
		}
	}

	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if match := findElement(child, tag, attrKey, attrValue); match != nil {
			return match
		}
	}
	return nil
}

func appendMeta(head *html.Node, attrKey string, attrValue string, content string) {
	if content == "" {
		return
	}
	head.AppendChild(element("meta",
		html.Attribute{Key: attrKey, Val: attrValue},
		html.Attribute{Key: "content", Val: content},
	))
}

func element(tag string, attrs ...html.Attribute) *html.Node {
	return &html.Node{Type: html.ElementNode, Data: tag, Attr: attrs}
}

func text(value string) *html.Node {
	return &html.Node{Type: html.TextNode, Data: value}
}

func withText(node *html.Node, value string) *html.Node {
	node.AppendChild(text(value))
	return node
}

func replaceChildren(parent *html.Node, children ...*html.Node) {
	for parent.FirstChild != nil {
		parent.RemoveChild(parent.FirstChild)
	}
	for _, child := range children {
		parent.AppendChild(child)
	}
}
