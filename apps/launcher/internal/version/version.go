package version

import (
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/coder-virjay/fast-note/apps/launcher/internal/config"
)

var (
	BuildAppVersion        = "dev"
	BuildChannel           = "dev"
	BuildManifestURL       = ""
	BuildPocketBaseVersion = "unknown"
	BuildTime              = ""
	BuildCommit            = ""
)

type Metadata struct {
	SchemaVersion     int    `json:"schemaVersion"`
	AppVersion        string `json:"appVersion"`
	Channel           string `json:"channel"`
	ManifestURL       string `json:"manifestUrl"`
	PocketBaseVersion string `json:"pocketBaseVersion"`
	BuiltAt           string `json:"builtAt,omitempty"`
	Platform          string `json:"platform,omitempty"`
	Commit            string `json:"commit,omitempty"`
	Source            string `json:"-"`
}

func Load(cfg config.Config) (Metadata, error) {
	metadata := fallbackMetadata()

	content, err := os.ReadFile(cfg.VersionFile)
	if err != nil {
		if os.IsNotExist(err) {
			metadata.Source = "build"
			return metadata, nil
		}

		return Metadata{}, fmt.Errorf("read version file: %w", err)
	}

	if err := json.Unmarshal(content, &metadata); err != nil {
		return Metadata{}, fmt.Errorf("parse version file: %w", err)
	}

	metadata.Source = "file"
	mergeFallback(&metadata)

	return metadata, nil
}

func fallbackMetadata() Metadata {
	return Metadata{
		SchemaVersion:     1,
		AppVersion:        emptyFallback(BuildAppVersion, "dev"),
		Channel:           emptyFallback(BuildChannel, "dev"),
		ManifestURL:       BuildManifestURL,
		PocketBaseVersion: emptyFallback(BuildPocketBaseVersion, "unknown"),
		BuiltAt:           BuildTime,
		Commit:            BuildCommit,
		Platform:          platformKey(),
	}
}

func mergeFallback(metadata *Metadata) {
	fallback := fallbackMetadata()

	if metadata.SchemaVersion == 0 {
		metadata.SchemaVersion = fallback.SchemaVersion
	}
	if metadata.AppVersion == "" {
		metadata.AppVersion = fallback.AppVersion
	}
	if metadata.Channel == "" {
		metadata.Channel = fallback.Channel
	}
	if metadata.ManifestURL == "" {
		metadata.ManifestURL = fallback.ManifestURL
	}
	if metadata.PocketBaseVersion == "" {
		metadata.PocketBaseVersion = fallback.PocketBaseVersion
	}
	if metadata.BuiltAt == "" {
		metadata.BuiltAt = fallback.BuiltAt
	}
	if metadata.Commit == "" {
		metadata.Commit = fallback.Commit
	}
	if metadata.Platform == "" {
		metadata.Platform = fallback.Platform
	}
}

func ResolveManifestURL(metadata Metadata) string {
	if value := strings.TrimSpace(os.Getenv("FASTNOTE_UPDATE_MANIFEST_URL")); value != "" {
		return value
	}

	return strings.TrimSpace(metadata.ManifestURL)
}

func platformKey() string {
	arch := runtime.GOARCH
	switch arch {
	case "amd64":
		arch = "x64"
	}

	return runtime.GOOS + "-" + arch
}

func emptyFallback(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}

	return value
}
