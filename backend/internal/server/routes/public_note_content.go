package routes

import (
	"net/url"
	"strconv"
	"strings"
	"unicode"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

type sanitizedPublicNoteContent struct {
	Nodes         []*html.Node
	FirstImageURL string
	HasH1         bool
	HasContent    bool
}

var publicNoteAllowedElements = map[string]bool{
	"a": true, "b": true, "blockquote": true, "br": true, "code": true,
	"del": true, "div": true, "em": true, "h1": true, "h2": true,
	"h3": true, "h4": true, "h5": true, "h6": true, "hr": true,
	"i": true, "img": true, "input": true, "li": true, "mark": true,
	"ol": true, "p": true, "pre": true, "s": true, "span": true,
	"strike": true, "strong": true, "sub": true, "sup": true,
	"table": true, "tbody": true, "td": true, "tfoot": true,
	"th": true, "thead": true, "tr": true, "u": true, "ul": true,
}

var publicNoteDroppedElements = map[string]bool{
	"audio": true, "embed": true, "iframe": true, "math": true,
	"object": true, "script": true, "style": true, "svg": true,
	"template": true, "video": true,
}

func sanitizePublicNoteContent(content string, noteID string) (sanitizedPublicNoteContent, error) {
	context := &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div}
	parsed, err := html.ParseFragment(strings.NewReader(content), context)
	if err != nil {
		return sanitizedPublicNoteContent{}, err
	}

	result := sanitizedPublicNoteContent{}
	for _, node := range parsed {
		for _, clean := range sanitizePublicNoteNode(node, noteID) {
			result.Nodes = append(result.Nodes, clean)
		}
	}
	for _, node := range result.Nodes {
		inspectSanitizedPublicNote(node, &result)
	}
	return result, nil
}

func sanitizePublicNoteNode(node *html.Node, noteID string) []*html.Node {
	switch node.Type {
	case html.TextNode:
		return []*html.Node{{Type: html.TextNode, Data: node.Data}}
	case html.ElementNode:
		tag := strings.ToLower(node.Data)
		if publicNoteDroppedElements[tag] {
			return nil
		}
		if !publicNoteAllowedElements[tag] {
			return sanitizePublicNoteChildren(node, noteID)
		}
		if tag == "input" && !hasHTMLAttributeValue(node.Attr, "type", "checkbox") {
			return nil
		}

		clean := &html.Node{Type: html.ElementNode, Data: tag, Attr: sanitizePublicNoteAttributes(tag, node.Attr, noteID)}
		if tag != "img" && tag != "input" && tag != "br" && tag != "hr" {
			for _, child := range sanitizePublicNoteChildren(node, noteID) {
				clean.AppendChild(child)
			}
		}
		return []*html.Node{clean}
	default:
		return nil
	}
}

func hasHTMLAttributeValue(attrs []html.Attribute, key string, value string) bool {
	for _, attr := range attrs {
		if strings.EqualFold(attr.Key, key) && strings.EqualFold(attr.Val, value) {
			return true
		}
	}
	return false
}

func sanitizePublicNoteChildren(node *html.Node, noteID string) []*html.Node {
	var children []*html.Node
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		children = append(children, sanitizePublicNoteNode(child, noteID)...)
	}
	return children
}

func sanitizePublicNoteAttributes(tag string, attrs []html.Attribute, noteID string) []html.Attribute {
	values := make(map[string]string, len(attrs))
	for _, attr := range attrs {
		values[strings.ToLower(attr.Key)] = attr.Val
	}
	attachment := values["data-note-attachment"] == "image" || values["data-note-attachment"] == "file"

	var clean []html.Attribute
	appendAttr := func(key string, value string) {
		if value != "" {
			clean = append(clean, html.Attribute{Key: key, Val: value})
		}
	}
	for _, key := range []string{"data-note-attachment", "data-file-type", "data-file-name", "data-file-size", "data-type"} {
		appendAttr(key, values[key])
	}
	appendAttr("title", values["title"])
	appendAttr("aria-label", values["aria-label"])

	switch tag {
	case "a":
		href := values["href"]
		if attachment {
			href = normalizePublicAttachmentURL(noteID, href)
		}
		if isSafePublicURL(href, true) {
			appendAttr("href", strings.TrimSpace(href))
		}
		appendAttr("download", values["download"])
		if values["target"] == "_blank" {
			appendAttr("target", "_blank")
			appendAttr("rel", "noopener noreferrer")
		}
	case "img":
		src := values["src"]
		if attachment {
			src = normalizePublicAttachmentURL(noteID, src)
		}
		if isSafePublicURL(src, false) {
			appendAttr("src", strings.TrimSpace(src))
		}
		appendAttr("alt", values["alt"])
		appendAttr("width", validPositiveInteger(values["width"]))
		appendAttr("height", validPositiveInteger(values["height"]))
		if values["loading"] == "lazy" || values["loading"] == "eager" {
			appendAttr("loading", values["loading"])
		}
		if values["decoding"] == "async" || values["decoding"] == "sync" || values["decoding"] == "auto" {
			appendAttr("decoding", values["decoding"])
		}
	case "input":
		if !strings.EqualFold(values["type"], "checkbox") {
			return nil
		}
		appendAttr("type", "checkbox")
		if _, ok := values["checked"]; ok {
			appendAttr("checked", "checked")
		}
		appendAttr("disabled", "disabled")
	case "td", "th":
		appendAttr("colspan", validPositiveInteger(values["colspan"]))
		appendAttr("rowspan", validPositiveInteger(values["rowspan"]))
	}
	return clean
}

func normalizePublicAttachmentURL(noteID string, value string) string {
	value = strings.TrimSpace(value)
	if noteID == "" || value == "" || strings.ContainsAny(value, "/\\:?#") || strings.HasPrefix(value, ".") {
		return value
	}
	return "/api/files/notes/" + url.PathEscape(noteID) + "/" + url.PathEscape(value)
}

func isSafePublicURL(value string, allowMailto bool) bool {
	value = strings.TrimSpace(value)
	if value == "" || strings.HasPrefix(value, "//") || strings.Contains(value, "\\") {
		return false
	}
	for _, character := range value {
		if unicode.IsControl(character) {
			return false
		}
	}
	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}
	switch strings.ToLower(parsed.Scheme) {
	case "":
		return true
	case "http", "https":
		return parsed.Host != ""
	case "mailto":
		return allowMailto
	default:
		return false
	}
}

func validPositiveInteger(value string) string {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return ""
	}
	return strconv.Itoa(parsed)
}

func inspectSanitizedPublicNote(node *html.Node, result *sanitizedPublicNoteContent) {
	if node.Type == html.TextNode && strings.TrimSpace(node.Data) != "" {
		result.HasContent = true
	}
	if node.Type == html.ElementNode {
		if node.Data == "h1" && strings.TrimSpace(publicNoteTextContent(node)) != "" {
			result.HasH1 = true
		}
		if node.Data == "img" && result.FirstImageURL == "" {
			for _, attr := range node.Attr {
				if attr.Key == "src" {
					result.FirstImageURL = attr.Val
					result.HasContent = true
					break
				}
			}
		}
		if node.Data == "hr" || node.Data == "input" {
			result.HasContent = true
		}
	}
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		inspectSanitizedPublicNote(child, result)
	}
}

func publicNoteTextContent(node *html.Node) string {
	var content strings.Builder
	var visit func(*html.Node)
	visit = func(current *html.Node) {
		if current.Type == html.TextNode {
			content.WriteString(current.Data)
		}
		for child := current.FirstChild; child != nil; child = child.NextSibling {
			visit(child)
		}
	}
	visit(node)
	return content.String()
}

func absolutePublicURL(canonicalURL string, value string) string {
	if !isSafePublicURL(value, false) {
		return ""
	}
	imageURL, err := url.Parse(value)
	if err != nil {
		return ""
	}
	if imageURL.IsAbs() {
		return imageURL.String()
	}
	baseURL, err := url.Parse(canonicalURL)
	if err != nil || !baseURL.IsAbs() {
		return ""
	}
	return baseURL.ResolveReference(imageURL).String()
}
