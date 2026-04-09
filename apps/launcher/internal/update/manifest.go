package update

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Manifest struct {
	SchemaVersion int                 `json:"schemaVersion"`
	Channel       string              `json:"channel"`
	Latest        Release             `json:"latest"`
	Artifacts     map[string]Artifact `json:"artifacts"`
}

type Release struct {
	Version             string `json:"version"`
	PublishedAt         string `json:"publishedAt"`
	NotesURL            string `json:"notes"`
	MinSupportedVersion string `json:"minSupportedVersion"`
}

type Artifact struct {
	URL       string `json:"url"`
	SHA256    string `json:"sha256"`
	FileName  string `json:"fileName,omitempty"`
	SizeBytes int64  `json:"sizeBytes,omitempty"`
}

func loadManifest(ctx context.Context, location string) ([]byte, error) {
	if strings.HasPrefix(location, "http://") || strings.HasPrefix(location, "https://") {
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, location, nil)
		if err != nil {
			return nil, fmt.Errorf("build request: %w", err)
		}

		client := &http.Client{
			Timeout: 10 * time.Second,
		}

		response, err := client.Do(request)
		if err != nil {
			return nil, fmt.Errorf("fetch manifest: %w", err)
		}
		defer response.Body.Close()

		if response.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("fetch manifest: unexpected status %s", response.Status)
		}

		content, err := io.ReadAll(response.Body)
		if err != nil {
			return nil, fmt.Errorf("read manifest: %w", err)
		}

		return content, nil
	}

	if strings.HasPrefix(location, "file://") {
		parsed, err := url.Parse(location)
		if err != nil {
			return nil, fmt.Errorf("parse manifest file URL: %w", err)
		}

		return os.ReadFile(parsed.Path)
	}

	absolutePath, err := filepath.Abs(location)
	if err != nil {
		return nil, fmt.Errorf("resolve manifest path: %w", err)
	}

	content, err := os.ReadFile(absolutePath)
	if err != nil {
		return nil, fmt.Errorf("read manifest file: %w", err)
	}

	return content, nil
}

func parseManifest(content []byte) (Manifest, error) {
	var manifest Manifest
	if err := json.Unmarshal(content, &manifest); err != nil {
		return Manifest{}, fmt.Errorf("decode manifest: %w", err)
	}

	if strings.TrimSpace(manifest.Latest.Version) == "" {
		return Manifest{}, fmt.Errorf("manifest latest.version is empty")
	}

	return manifest, nil
}
