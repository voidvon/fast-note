package update

import (
	"context"
	"fmt"

	versioninfo "github.com/coder-virjay/fast-note/apps/launcher/internal/version"
)

type CheckResult struct {
	CurrentVersion string
	LatestVersion  string
	HasUpdate      bool
	ManifestURL    string
	Artifact       Artifact
	NotesURL       string
	Channel        string
}

func Check(ctx context.Context, metadata versioninfo.Metadata) (CheckResult, error) {
	manifestURL := versioninfo.ResolveManifestURL(metadata)
	if manifestURL == "" {
		return CheckResult{}, fmt.Errorf("update manifest is not configured; set FASTNOTE_UPDATE_MANIFEST_URL or provide manifestUrl in version.json")
	}

	var manifest Manifest
	content, err := loadManifest(ctx, manifestURL)
	if err != nil {
		return CheckResult{}, err
	}

	manifest, err = parseManifest(content)
	if err != nil {
		return CheckResult{}, err
	}

	result := CheckResult{
		CurrentVersion: metadata.AppVersion,
		LatestVersion:  manifest.Latest.Version,
		ManifestURL:    manifestURL,
		NotesURL:       manifest.Latest.NotesURL,
		Channel:        manifest.Channel,
	}

	if artifact, ok := manifest.Artifacts[metadata.Platform]; ok {
		result.Artifact = artifact
	}

	comparison, err := compareVersions(metadata.AppVersion, manifest.Latest.Version)
	if err != nil {
		return CheckResult{}, err
	}

	result.HasUpdate = comparison < 0

	return result, nil
}

func compareVersions(current string, latest string) (int, error) {
	currentParts, err := parseVersion(current)
	if err != nil {
		return 0, fmt.Errorf("parse current version %q: %w", current, err)
	}
	latestParts, err := parseVersion(latest)
	if err != nil {
		return 0, fmt.Errorf("parse latest version %q: %w", latest, err)
	}

	maxLen := len(currentParts)
	if len(latestParts) > maxLen {
		maxLen = len(latestParts)
	}

	for len(currentParts) < maxLen {
		currentParts = append(currentParts, 0)
	}
	for len(latestParts) < maxLen {
		latestParts = append(latestParts, 0)
	}

	for index := 0; index < maxLen; index++ {
		switch {
		case currentParts[index] < latestParts[index]:
			return -1, nil
		case currentParts[index] > latestParts[index]:
			return 1, nil
		}
	}

	return 0, nil
}
