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
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"golang.org/x/net/html"
)

const (
	defaultNoteTitle  = "未命名备忘录"
	devIndexURLEnv    = "FASTNOTE_DEV_INDEX_URL"
	maxIndexHTMLSize  = 2 << 20
	maxTitleRunes     = 120
	maxSummaryRunes   = 320
	publicListLimit   = 30
	maxPublicListPage = 1000
)

var errPublicPageNotFound = errors.New("public page not found")

type publicNotePageData struct {
	Title        string
	Summary      string
	CanonicalURL string
}

type publicListItem struct {
	Title   string
	Summary string
	URL     string
}

type publicListPageData struct {
	Title        string
	Description  string
	CanonicalURL string
	Items        []publicListItem
	PreviousURL  string
	NextURL      string
}

type publicPageRoute struct {
	Username string
	NoteID   string
	FolderID string
	Path     string
	Kind     string
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
		route, ok := matchPublicPagePath(e.Request.URL.Path)
		if !ok {
			return fallback(e)
		}

		indexHTML, err := templates.load(e.Request.Context())
		if err != nil {
			e.App.Logger().Error("failed to load frontend index.html", "error", err)
			return fallback(e)
		}

		var rendered string
		if route.Kind == "note" {
			page, findErr := findPublicNotePage(e, route.Username, route.NoteID)
			if findErr == nil {
				rendered, err = renderPublicNotePage(indexHTML, page)
			} else {
				err = findErr
			}
		} else {
			page, findErr := findPublicListPage(e, route)
			if findErr == nil {
				rendered, err = renderPublicListPage(indexHTML, page)
			} else {
				err = findErr
			}
		}

		if err != nil {
			if !errors.Is(err, errPublicPageNotFound) {
				e.App.Logger().Error("failed to render public page snapshot", "error", err)
			}
			if templates.devURL != "" {
				return e.HTML(http.StatusOK, string(indexHTML))
			}
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
	route, ok := matchPublicPagePath(path)
	if !ok || route.Kind != "note" {
		return "", "", false
	}
	return route.Username, route.NoteID, true
}

func matchPublicPagePath(path string) (publicPageRoute, bool) {
	cleanPath := "/" + strings.Trim(path, "/")
	segments := strings.Split(strings.Trim(cleanPath, "/"), "/")
	if len(segments) == 0 || !isPublicUsernameSegment(segments[0]) {
		return publicPageRoute{}, false
	}

	route := publicPageRoute{Username: segments[0], Path: cleanPath}
	switch {
	case len(segments) == 1:
		route.Kind = "home"
	case len(segments) == 3 && segments[1] == "n" && segments[2] != "":
		route.Kind = "note"
		route.NoteID = segments[2]
	case len(segments) >= 3 && segments[1] == "f" && segments[len(segments)-1] != "":
		route.Kind = "folder"
		route.FolderID = segments[len(segments)-1]
	default:
		return publicPageRoute{}, false
	}
	return route, true
}

func isPublicUsernameSegment(value string) bool {
	if value == "" || strings.Contains(value, ".") {
		return false
	}
	switch value {
	case "_", "api", "deleted", "f", "home", "login", "n", "register":
		return false
	default:
		return true
	}
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
		return publicNotePageData{}, errPublicPageNotFound
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

func findPublicListPage(e *core.RequestEvent, route publicPageRoute) (publicListPageData, error) {
	user, err := e.App.FindFirstRecordByData("users", "username", route.Username)
	if err != nil {
		return publicListPageData{}, normalizeLookupError(err)
	}

	pageNumber := parsePageNumber(e.Request.URL.Query().Get("page"))
	basePath := route.Path
	page := publicListPageData{
		Title:        route.Username + " 的公开备忘录",
		Description:  route.Username + " 在 fastnote 上公开的备忘录",
		CanonicalURL: buildPublicPageURL(e.App.Settings().Meta.AppURL, basePath, pageNumber),
	}

	filter := "is_public = true && is_deleted = 0 && user_id = {:userId}"
	params := dbx.Params{"userId": user.Id}
	if route.Kind == "home" {
		filter += " && item_type = 1 && parent_id = ''"
	} else if route.FolderID == "unfilednotes" {
		page.Title = "备忘录 - " + route.Username
		filter += " && item_type = 2 && parent_id = ''"
	} else {
		folder, findErr := e.App.FindRecordById("notes", route.FolderID)
		if findErr != nil {
			return publicListPageData{}, normalizeLookupError(findErr)
		}
		if !isPublicFolderForUser(folder, user.Id) {
			return publicListPageData{}, errPublicPageNotFound
		}
		folderTitle := truncateText(folder.GetString("title"), maxTitleRunes)
		if folderTitle == "" {
			folderTitle = "未命名文件夹"
		}
		page.Title = folderTitle + " - " + route.Username
		page.Description = route.Username + " 的公开文件夹：" + folderTitle
		filter += " && (item_type = 1 || item_type = 2) && parent_id = {:parentId}"
		params["parentId"] = route.FolderID
	}

	offset := (pageNumber - 1) * publicListLimit
	records, err := e.App.FindRecordsByFilter(
		"notes",
		filter,
		"+item_type,-updated",
		publicListLimit+1,
		offset,
		params,
	)
	if err != nil {
		return publicListPageData{}, err
	}
	hasNext := len(records) > publicListLimit
	if hasNext {
		records = records[:publicListLimit]
	}

	if route.Kind == "home" && pageNumber == 1 {
		unfiled, findErr := e.App.FindRecordsByFilter(
			"notes",
			"is_public = true && is_deleted = 0 && item_type = 2 && parent_id = '' && user_id = {:userId}",
			"-updated",
			1,
			0,
			params,
		)
		if findErr != nil {
			return publicListPageData{}, findErr
		}
		if len(unfiled) > 0 {
			page.Items = append(page.Items, publicListItem{
				Title: "备忘录",
				URL:   buildPublicFolderPath(route.Username, "unfilednotes"),
			})
		}
	}

	for _, record := range records {
		title := truncateText(record.GetString("title"), maxTitleRunes)
		if title == "" {
			if record.GetInt("item_type") == 1 {
				title = "未命名文件夹"
			} else {
				title = defaultNoteTitle
			}
		}
		item := publicListItem{
			Title:   title,
			Summary: truncateText(record.GetString("summary"), maxSummaryRunes),
		}
		if record.GetInt("item_type") == 1 {
			item.URL = strings.TrimRight(basePath, "/") + "/" + url.PathEscape(record.Id)
			if route.Kind == "home" {
				item.URL = buildPublicFolderPath(route.Username, record.Id)
			}
		} else {
			item.URL = buildPublicNotePath(route.Username, record.Id)
		}
		page.Items = append(page.Items, item)
	}

	if pageNumber > 1 {
		page.PreviousURL = buildPagePath(basePath, pageNumber-1)
	}
	if hasNext {
		page.NextURL = buildPagePath(basePath, pageNumber+1)
	}
	return page, nil
}

func normalizeLookupError(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return errPublicPageNotFound
	}
	return err
}

func isPublicFolderForUser(folder *core.Record, userID string) bool {
	return folder.GetString("user_id") == userID &&
		folder.GetBool("is_public") &&
		folder.GetInt("is_deleted") == 0 &&
		folder.GetInt("item_type") == 1
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

func buildPublicNotePath(username string, noteID string) string {
	return "/" + url.PathEscape(username) + "/n/" + url.PathEscape(noteID)
}

func buildPublicFolderPath(username string, folderID string) string {
	return "/" + url.PathEscape(username) + "/f/" + url.PathEscape(folderID)
}

func buildPagePath(path string, page int) string {
	if page <= 1 {
		return path
	}
	return path + "?page=" + fmt.Sprint(page)
}

func buildPublicPageURL(appURL string, path string, page int) string {
	baseURL := strings.TrimRight(strings.TrimSpace(appURL), "/")
	if baseURL == "" {
		return ""
	}
	return baseURL + buildPagePath(path, page)
}

func parsePageNumber(value string) int {
	page, err := strconv.Atoi(value)
	if err != nil || page < 1 || page > maxPublicListPage {
		return 1
	}
	return page
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

func renderPublicListPage(indexHTML []byte, page publicListPageData) (string, error) {
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
	appendMeta(head, "name", "description", page.Description)
	appendMeta(head, "property", "og:type", "website")
	appendMeta(head, "property", "og:title", documentTitle)
	appendMeta(head, "property", "og:description", page.Description)
	if page.CanonicalURL != "" {
		head.AppendChild(element("link",
			html.Attribute{Key: "rel", Val: "canonical"},
			html.Attribute{Key: "href", Val: page.CanonicalURL},
		))
	}

	main := element("main", html.Attribute{Key: "data-server-rendered", Val: "public-list"})
	main.AppendChild(withText(element("h1"), page.Title))
	list := element("ul")
	for _, item := range page.Items {
		link := withText(element("a", html.Attribute{Key: "href", Val: item.URL}), item.Title)
		listItem := element("li")
		listItem.AppendChild(link)
		if item.Summary != "" {
			listItem.AppendChild(withText(element("p"), item.Summary))
		}
		list.AppendChild(listItem)
	}
	main.AppendChild(list)
	if page.PreviousURL != "" || page.NextURL != "" {
		navigation := element("nav", html.Attribute{Key: "aria-label", Val: "公开内容分页"})
		if page.PreviousURL != "" {
			navigation.AppendChild(withText(element("a", html.Attribute{Key: "href", Val: page.PreviousURL}), "上一页"))
		}
		if page.NextURL != "" {
			navigation.AppendChild(withText(element("a", html.Attribute{Key: "href", Val: page.NextURL}), "下一页"))
		}
		main.AppendChild(navigation)
	}
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
