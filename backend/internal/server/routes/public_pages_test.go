package routes

import (
	"database/sql"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/pocketbase/pocketbase/core"
)

const testIndexHTML = `<!doctype html><html><head><title>fastnote</title></head><body><div id="app"></div><div id="app-loading"></div><script src="/app.js"></script></body></html>`

func TestRenderPublicNotePage(t *testing.T) {
	rendered, err := renderPublicNotePage([]byte(testIndexHTML), publicNotePageData{
		Title:        `标题 <script>alert("x")</script>`,
		Summary:      `摘要"><img src=x onerror=alert(1)>`,
		CanonicalURL: "https://example.com/user/n/note",
	})
	if err != nil {
		t.Fatal(err)
	}

	expected := []string{
		`<title>标题 &lt;script&gt;alert(&#34;x&#34;)&lt;/script&gt; - fastnote</title>`,
		`name="description" content="摘要&#34;&gt;&lt;img src=x onerror=alert(1)&gt;"`,
		`property="og:title"`,
		`rel="canonical" href="https://example.com/user/n/note"`,
		`<h1>标题 &lt;script&gt;alert(&#34;x&#34;)&lt;/script&gt;</h1>`,
		`<p>摘要&#34;&gt;&lt;img src=x onerror=alert(1)&gt;</p>`,
		`<div id="app-loading"></div>`,
		`<script src="/app.js"></script>`,
	}
	for _, value := range expected {
		if !strings.Contains(rendered, value) {
			t.Errorf("rendered HTML does not contain %q:\n%s", value, rendered)
		}
	}

	if strings.Contains(rendered, `<img src=x`) || strings.Contains(rendered, `<script>alert`) {
		t.Fatalf("rendered HTML contains unescaped note data:\n%s", rendered)
	}
}

func TestRenderPublicNotePageRequiresAppMount(t *testing.T) {
	_, err := renderPublicNotePage([]byte(`<html><head></head><body></body></html>`), publicNotePageData{Title: "title"})
	if err == nil {
		t.Fatal("expected missing #app to fail")
	}
}

func TestPublicPageTemplateLoaderUsesDevIndex(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Accept") != "text/html" {
			t.Errorf("unexpected Accept header: %q", request.Header.Get("Accept"))
		}
		_, _ = io.WriteString(response, "<html>dev</html>")
	}))
	defer server.Close()

	loader, err := newPublicPageTemplateLoader(fstest.MapFS{
		"index.html": {Data: []byte("<html>static</html>")},
	}, server.URL)
	if err != nil {
		t.Fatal(err)
	}

	indexHTML, err := loader.load(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if got := string(indexHTML); got != "<html>dev</html>" {
		t.Fatalf("unexpected development index: %q", got)
	}
}

func TestPublicPageTemplateLoaderFallsBackToStaticIndex(t *testing.T) {
	loader, err := newPublicPageTemplateLoader(fstest.MapFS{
		"index.html": {Data: []byte("<html>static</html>")},
	}, "http://127.0.0.1:1/index.html")
	if err != nil {
		t.Fatal(err)
	}

	indexHTML, err := loader.load(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if got := string(indexHTML); got != "<html>static</html>" {
		t.Fatalf("unexpected fallback index: %q", got)
	}
}

func TestIsPublicNoteForUser(t *testing.T) {
	record := core.NewRecord(core.NewBaseCollection("notes"))
	record.Set("user_id", "user-1")
	record.Set("is_public", 1)
	record.Set("is_deleted", 0)
	record.Set("item_type", 2)

	if !isPublicNoteForUser(record, "user-1") {
		t.Fatal("expected public note owned by the user to be renderable")
	}

	tests := []struct {
		name  string
		field string
		value any
	}{
		{name: "different owner", field: "user_id", value: "user-2"},
		{name: "private", field: "is_public", value: 0},
		{name: "deleted", field: "is_deleted", value: 1},
		{name: "folder", field: "item_type", value: 1},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			copy := record.Fresh()
			copy.Set(test.field, test.value)
			if isPublicNoteForUser(copy, "user-1") {
				t.Fatal("expected record to be excluded")
			}
		})
	}
}

func TestTruncateText(t *testing.T) {
	if got := truncateText("  一行\n  二行   三行  ", 5); got != "一行 二行" {
		t.Fatalf("unexpected truncated text: %q", got)
	}
}

func TestMatchPublicNotePath(t *testing.T) {
	username, noteID, ok := matchPublicNotePath("/voidfeng/n/sn8grXX04nND")
	if !ok || username != "voidfeng" || noteID != "sn8grXX04nND" {
		t.Fatalf("unexpected match: username=%q noteID=%q ok=%v", username, noteID, ok)
	}

	for _, path := range []string{
		"/home",
		"/api/collections/notes",
		"/_/n/example",
		"/voidfeng/f/folder",
		"/voidfeng/n/note/extra",
	} {
		if _, _, ok := matchPublicNotePath(path); ok {
			t.Fatalf("expected %q not to match", path)
		}
	}
}

func TestNormalizeLookupError(t *testing.T) {
	if !errors.Is(normalizeLookupError(sql.ErrNoRows), errPublicNoteNotFound) {
		t.Fatal("expected sql.ErrNoRows to become a public note miss")
	}

	expected := errors.New("database unavailable")
	if !errors.Is(normalizeLookupError(expected), expected) {
		t.Fatal("expected operational database error to be preserved")
	}
}
