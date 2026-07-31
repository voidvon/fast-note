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
	"golang.org/x/net/html"
)

const testIndexHTML = `<!doctype html><html><head><title>fastnote</title></head><body><div id="app"></div><div id="app-loading"></div><script src="/app.js"></script></body></html>`

func TestRenderPublicNotePage(t *testing.T) {
	rendered, err := renderPublicNotePage([]byte(testIndexHTML), publicNotePageData{
		Title:   `标题 <script>alert("x")</script>`,
		Summary: `摘要"><img src=x onerror=alert(1)>`,
		Content: `
			<h1>正文标题</h1>
			<p onclick="alert(1)">正文<strong>内容</strong><script>alert(1)</script></p>
			<img data-note-attachment="image" data-file-type="image/png" data-file-name="封面.png" src="/api/files/notes/note/cover.png" alt="封面" onerror="alert(1)">
			<a data-note-attachment="file" data-file-type="application/pdf" href="javascript:alert(1)">危险附件</a>
			<file-upload url="legacy.png" type="image/png"></file-upload>
		`,
		NoteID:       "note",
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
		`<h1>正文标题</h1>`,
		`<p>正文<strong>内容</strong></p>`,
		`src="/api/files/notes/note/cover.png"`,
		`alt="封面"`,
		`property="og:image" content="https://example.com/api/files/notes/note/cover.png"`,
		`name="twitter:card" content="summary_large_image"`,
		`<div id="app-loading"></div>`,
		`<script src="/app.js"></script>`,
	}
	for _, value := range expected {
		if !strings.Contains(rendered, value) {
			t.Errorf("rendered HTML does not contain %q:\n%s", value, rendered)
		}
	}

	if strings.Contains(rendered, `<img src=x`) || strings.Contains(rendered, `<script>alert`) ||
		strings.Contains(rendered, `onclick="`) || strings.Contains(rendered, `onerror="`) ||
		strings.Contains(rendered, "javascript:") || strings.Contains(rendered, "file-upload") ||
		strings.Contains(rendered, `<h1>标题 &lt;script`) {
		t.Fatalf("rendered HTML contains unescaped note data:\n%s", rendered)
	}
}

func TestSanitizePublicNoteContentNormalizesAttachmentURLs(t *testing.T) {
	content, err := sanitizePublicNoteContent(`
		<p><a href="https://example.com/page">普通链接</a></p>
		<img data-note-attachment="image" data-file-type="image/png" data-file-name="photo.png" src="photo_random.png">
		<input type="text" value="unsafe"><input type="checkbox" checked>
	`, "note-id")
	if err != nil {
		t.Fatal(err)
	}

	container := element("div")
	for _, node := range content.Nodes {
		container.AppendChild(node)
	}
	var output strings.Builder
	if err := html.Render(&output, container); err != nil {
		t.Fatal(err)
	}
	rendered := output.String()
	if !strings.Contains(rendered, `href="https://example.com/page"`) {
		t.Fatalf("ordinary link was changed: %s", rendered)
	}
	if !strings.Contains(rendered, `src="/api/files/notes/note-id/photo_random.png"`) {
		t.Fatalf("attachment URL was not normalized: %s", rendered)
	}
	if strings.Contains(rendered, `type="text"`) || !strings.Contains(rendered, `type="checkbox"`) {
		t.Fatalf("input allowlist was not applied: %s", rendered)
	}
}

func TestRenderPublicNotePageRequiresAppMount(t *testing.T) {
	_, err := renderPublicNotePage([]byte(`<html><head></head><body></body></html>`), publicNotePageData{Title: "title"})
	if err == nil {
		t.Fatal("expected missing #app to fail")
	}
}

func TestRenderPublicNotePageFallsBackForEmptyBodyHeading(t *testing.T) {
	rendered, err := renderPublicNotePage([]byte(testIndexHTML), publicNotePageData{
		Title:   "有效标题",
		Summary: "有效摘要",
		Content: "<h1></h1><p></p>",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(rendered, "<h1>有效标题</h1>") || !strings.Contains(rendered, "<p>有效摘要</p>") {
		t.Fatalf("empty body did not receive metadata fallback: %s", rendered)
	}
}

func TestRenderPublicListPage(t *testing.T) {
	rendered, err := renderPublicListPage([]byte(testIndexHTML), publicListPageData{
		Title:        `voidvon <公开>`,
		Description:  `公开列表"><script>alert(1)</script>`,
		CanonicalURL: "https://example.com/voidvon?page=2",
		Items: []publicListItem{
			{Title: `文件夹 <一>`, URL: "/voidvon/f/folder", Summary: ""},
			{Title: `笔记 "二"`, URL: "/voidvon/n/note", Summary: `<img src=x>`},
		},
		PreviousURL: "/voidvon",
		NextURL:     "/voidvon?page=3",
	})
	if err != nil {
		t.Fatal(err)
	}

	expected := []string{
		`<title>voidvon &lt;公开&gt; - fastnote</title>`,
		`rel="canonical" href="https://example.com/voidvon?page=2"`,
		`<main data-server-rendered="public-list">`,
		`<a href="/voidvon/f/folder">文件夹 &lt;一&gt;</a>`,
		`<a href="/voidvon/n/note">笔记 &#34;二&#34;</a>`,
		`<p>&lt;img src=x&gt;</p>`,
		`<a href="/voidvon">上一页</a>`,
		`<a href="/voidvon?page=3">下一页</a>`,
	}
	for _, value := range expected {
		if !strings.Contains(rendered, value) {
			t.Errorf("rendered HTML does not contain %q:\n%s", value, rendered)
		}
	}
	if strings.Contains(rendered, `<script>alert`) || strings.Contains(rendered, `<img src=x>`) {
		t.Fatalf("rendered HTML contains unescaped list data:\n%s", rendered)
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

func TestMatchPublicPagePath(t *testing.T) {
	tests := []struct {
		path     string
		kind     string
		username string
		folderID string
	}{
		{path: "/voidvon", kind: "home", username: "voidvon"},
		{path: "/voidvon/", kind: "home", username: "voidvon"},
		{path: "/voidvon/f/unfilednotes", kind: "folder", username: "voidvon", folderID: "unfilednotes"},
		{path: "/voidvon/f/parent/child", kind: "folder", username: "voidvon", folderID: "child"},
	}
	for _, test := range tests {
		route, ok := matchPublicPagePath(test.path)
		if !ok || route.Kind != test.kind || route.Username != test.username || route.FolderID != test.folderID {
			t.Fatalf("unexpected route for %q: %#v, ok=%v", test.path, route, ok)
		}
	}

	for _, path := range []string{"/", "/api", "/home", "/login", "/deleted", "/_/f/folder", "/app.js", "/voidvon/f"} {
		if route, ok := matchPublicPagePath(path); ok {
			t.Fatalf("expected %q not to match, got %#v", path, route)
		}
	}
}

func TestPublicListPageHelpers(t *testing.T) {
	if got := parsePageNumber("3"); got != 3 {
		t.Fatalf("unexpected page number: %d", got)
	}
	for _, value := range []string{"", "0", "-1", "2abc", "1001", "invalid"} {
		if got := parsePageNumber(value); got != 1 {
			t.Fatalf("expected %q to resolve to page 1, got %d", value, got)
		}
	}
	if got := buildPagePath("/voidvon", 1); got != "/voidvon" {
		t.Fatalf("unexpected first page path: %q", got)
	}
	if got := buildPagePath("/voidvon", 2); got != "/voidvon?page=2" {
		t.Fatalf("unexpected paged path: %q", got)
	}
}

func TestNormalizeLookupError(t *testing.T) {
	if !errors.Is(normalizeLookupError(sql.ErrNoRows), errPublicPageNotFound) {
		t.Fatal("expected sql.ErrNoRows to become a public note miss")
	}

	expected := errors.New("database unavailable")
	if !errors.Is(normalizeLookupError(expected), expected) {
		t.Fatal("expected operational database error to be preserved")
	}
}
