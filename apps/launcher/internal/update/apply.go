package update

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/coder-virjay/fast-note/apps/launcher/internal/config"
	"github.com/coder-virjay/fast-note/apps/launcher/internal/runstate"
	versioninfo "github.com/coder-virjay/fast-note/apps/launcher/internal/version"
)

const (
	stateStatusDownloading = "downloading"
	stateStatusVerifying   = "verifying"
	stateStatusReady       = "ready_to_switch"
	stateStatusSwitching   = "switching"
	stateStatusCompleted   = "completed"
	stateStatusRolledBack  = "rolled_back"
)

type ApplyOptions struct {
	TargetVersion string
	DryRun        bool
}

type ApplyResult struct {
	CurrentVersion string
	TargetVersion  string
	ArtifactURL    string
	BackupDir      string
	DryRun         bool
}

type InstallState struct {
	Status      string `json:"status"`
	FromVersion string `json:"fromVersion"`
	ToVersion   string `json:"toVersion"`
	ArtifactURL string `json:"artifactUrl"`
	ArchivePath string `json:"archivePath,omitempty"`
	StagingDir  string `json:"stagingDir,omitempty"`
	BackupDir   string `json:"backupDir,omitempty"`
	LastError   string `json:"lastError,omitempty"`
}

type managedItem struct {
	Name string
	Kind string
}

func Apply(ctx context.Context, cfg config.Config, metadata versioninfo.Metadata, options ApplyOptions) (ApplyResult, error) {
	if runtime.GOOS == "windows" {
		return ApplyResult{}, fmt.Errorf("fastnote update is not supported on Windows yet")
	}
	activeRuntime, running, err := runstate.Active(cfg.RuntimeStateFile)
	if err != nil {
		return ApplyResult{}, err
	}
	if running {
		return ApplyResult{}, fmt.Errorf("cannot update while FastNote is running (launcher pid=%d addr=%s)", activeRuntime.LauncherPID, activeRuntime.HTTPAddr)
	}

	result, _, err := resolveUpdate(ctx, metadata, options.TargetVersion)
	if err != nil {
		return ApplyResult{}, err
	}
	if !result.HasUpdate && options.TargetVersion == "" {
		return ApplyResult{
			CurrentVersion: metadata.AppVersion,
			TargetVersion:  result.LatestVersion,
			ArtifactURL:    result.Artifact.URL,
			DryRun:         options.DryRun,
		}, nil
	}
	if strings.TrimSpace(result.Artifact.URL) == "" {
		return ApplyResult{}, fmt.Errorf("manifest does not contain an artifact for platform %s", metadata.Platform)
	}

	versionDir := filepath.Join(cfg.UpdatesDir, sanitizeVersion(result.LatestVersion))
	archiveName := artifactFileName(result.Artifact)
	archivePath := filepath.Join(versionDir, "downloads", archiveName)
	stagingRoot := filepath.Join(versionDir, "staging")
	backupDir := filepath.Join(versionDir, "backup")

	if err := os.MkdirAll(filepath.Dir(archivePath), 0o755); err != nil {
		return ApplyResult{}, fmt.Errorf("create download directory: %w", err)
	}
	if err := os.MkdirAll(stagingRoot, 0o755); err != nil {
		return ApplyResult{}, fmt.Errorf("create staging directory: %w", err)
	}

	state := InstallState{
		Status:      stateStatusDownloading,
		FromVersion: metadata.AppVersion,
		ToVersion:   result.LatestVersion,
		ArtifactURL: result.Artifact.URL,
		ArchivePath: archivePath,
		StagingDir:  stagingRoot,
		BackupDir:   backupDir,
	}
	if err := writeState(cfg.UpdateStateFile, state); err != nil {
		return ApplyResult{}, err
	}

	if err := fetchArtifact(ctx, result.Artifact.URL, archivePath); err != nil {
		state.LastError = err.Error()
		_ = writeState(cfg.UpdateStateFile, state)
		return ApplyResult{}, err
	}

	state.Status = stateStatusVerifying
	if err := writeState(cfg.UpdateStateFile, state); err != nil {
		return ApplyResult{}, err
	}

	if err := verifyChecksum(archivePath, result.Artifact.SHA256); err != nil {
		state.LastError = err.Error()
		_ = writeState(cfg.UpdateStateFile, state)
		return ApplyResult{}, err
	}

	if err := os.RemoveAll(stagingRoot); err != nil {
		return ApplyResult{}, fmt.Errorf("reset staging directory: %w", err)
	}
	if err := os.MkdirAll(stagingRoot, 0o755); err != nil {
		return ApplyResult{}, fmt.Errorf("create staging directory: %w", err)
	}

	if err := extractArchive(archivePath, stagingRoot); err != nil {
		state.LastError = err.Error()
		_ = writeState(cfg.UpdateStateFile, state)
		return ApplyResult{}, err
	}

	stagedRoot, err := locateReleaseRoot(stagingRoot)
	if err != nil {
		state.LastError = err.Error()
		_ = writeState(cfg.UpdateStateFile, state)
		return ApplyResult{}, err
	}

	if err := validateReleaseLayout(stagedRoot); err != nil {
		state.LastError = err.Error()
		_ = writeState(cfg.UpdateStateFile, state)
		return ApplyResult{}, err
	}

	state.Status = stateStatusReady
	if err := writeState(cfg.UpdateStateFile, state); err != nil {
		return ApplyResult{}, err
	}

	if options.DryRun {
		return ApplyResult{
			CurrentVersion: metadata.AppVersion,
			TargetVersion:  result.LatestVersion,
			ArtifactURL:    result.Artifact.URL,
			BackupDir:      backupDir,
			DryRun:         true,
		}, nil
	}

	state.Status = stateStatusSwitching
	if err := writeState(cfg.UpdateStateFile, state); err != nil {
		return ApplyResult{}, err
	}

	items := managedItems()
	if err := prepareBackupDir(backupDir); err != nil {
		return ApplyResult{}, err
	}

	for _, item := range items {
		currentPath := filepath.Join(cfg.RootDir, item.Name)
		if err := backupCurrentItem(currentPath, filepath.Join(backupDir, item.Name)); err != nil {
			state.LastError = err.Error()
			_ = writeState(cfg.UpdateStateFile, state)
			return ApplyResult{}, err
		}
	}

	if err := switchManagedItems(stagedRoot, cfg.RootDir, items); err != nil {
		rollbackErr := restoreBackup(cfg.RootDir, backupDir, items)
		state.Status = stateStatusRolledBack
		if rollbackErr != nil {
			state.LastError = fmt.Sprintf("%v; rollback failed: %v", err, rollbackErr)
		} else {
			state.LastError = err.Error()
		}
		_ = writeState(cfg.UpdateStateFile, state)
		if rollbackErr != nil {
			return ApplyResult{}, fmt.Errorf("apply update: %w (rollback failed: %v)", err, rollbackErr)
		}
		return ApplyResult{}, err
	}

	state.Status = stateStatusCompleted
	state.LastError = ""
	if err := writeState(cfg.UpdateStateFile, state); err != nil {
		return ApplyResult{}, err
	}

	return ApplyResult{
		CurrentVersion: metadata.AppVersion,
		TargetVersion:  result.LatestVersion,
		ArtifactURL:    result.Artifact.URL,
		BackupDir:      backupDir,
		DryRun:         false,
	}, nil
}

func resolveUpdate(ctx context.Context, metadata versioninfo.Metadata, targetVersion string) (CheckResult, Manifest, error) {
	manifestURL := versioninfo.ResolveManifestURL(metadata)
	if manifestURL == "" {
		return CheckResult{}, Manifest{}, fmt.Errorf("update manifest is not configured; set FASTNOTE_UPDATE_MANIFEST_URL or provide manifestUrl in version.json")
	}

	content, err := loadManifest(ctx, manifestURL)
	if err != nil {
		return CheckResult{}, Manifest{}, err
	}

	manifest, err := parseManifest(content)
	if err != nil {
		return CheckResult{}, Manifest{}, err
	}

	result := CheckResult{
		CurrentVersion: metadata.AppVersion,
		LatestVersion:  manifest.Latest.Version,
		ManifestURL:    manifestURL,
		NotesURL:       manifest.Latest.NotesURL,
		Channel:        manifest.Channel,
	}

	artifact, ok := manifest.Artifacts[metadata.Platform]
	if !ok {
		return CheckResult{}, Manifest{}, fmt.Errorf("manifest does not define artifact for platform %s", metadata.Platform)
	}
	result.Artifact = artifact

	comparison, err := compareVersions(metadata.AppVersion, manifest.Latest.Version)
	if err != nil {
		return CheckResult{}, Manifest{}, err
	}
	result.HasUpdate = comparison < 0

	if targetVersion != "" {
		if manifest.Latest.Version != targetVersion {
			return CheckResult{}, Manifest{}, fmt.Errorf("manifest latest version is %s, requested %s", manifest.Latest.Version, targetVersion)
		}
		result.HasUpdate = comparison != 0
	}

	return result, manifest, nil
}

func writeState(path string, state InstallState) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create update state directory: %w", err)
	}

	content, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal update state: %w", err)
	}

	if err := os.WriteFile(path, content, 0o644); err != nil {
		return fmt.Errorf("write update state: %w", err)
	}

	return nil
}

func fetchArtifact(ctx context.Context, source string, destination string) error {
	switch {
	case strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://"):
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, source, nil)
		if err != nil {
			return fmt.Errorf("build artifact request: %w", err)
		}
		response, err := (&http.Client{}).Do(request)
		if err != nil {
			return fmt.Errorf("download artifact: %w", err)
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusOK {
			return fmt.Errorf("download artifact: unexpected status %s", response.Status)
		}
		return writeFromReader(destination, response.Body, 0o644)
	case strings.HasPrefix(source, "file://"):
		parsed, err := url.Parse(source)
		if err != nil {
			return fmt.Errorf("parse artifact file URL: %w", err)
		}
		return copyPath(parsed.Path, destination)
	default:
		absolutePath, err := filepath.Abs(source)
		if err != nil {
			return fmt.Errorf("resolve artifact path: %w", err)
		}
		return copyPath(absolutePath, destination)
	}
}

func verifyChecksum(filePath string, expected string) error {
	expected = strings.TrimSpace(strings.ToLower(expected))
	if expected == "" {
		return fmt.Errorf("artifact sha256 is empty")
	}

	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open artifact for checksum: %w", err)
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return fmt.Errorf("read artifact for checksum: %w", err)
	}

	actual := hex.EncodeToString(hash.Sum(nil))
	if actual != expected {
		return fmt.Errorf("artifact sha256 mismatch: expected %s got %s", expected, actual)
	}

	return nil
}

func extractArchive(archivePath string, destination string) error {
	switch {
	case strings.HasSuffix(archivePath, ".tar.gz"):
		return extractTarGz(archivePath, destination)
	case strings.HasSuffix(archivePath, ".zip"):
		return extractZip(archivePath, destination)
	default:
		return fmt.Errorf("unsupported artifact format: %s", archivePath)
	}
}

func extractTarGz(archivePath string, destination string) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return fmt.Errorf("open tar.gz archive: %w", err)
	}
	defer file.Close()

	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("open gzip reader: %w", err)
	}
	defer gzipReader.Close()

	reader := tar.NewReader(gzipReader)
	for {
		header, err := reader.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read tar entry: %w", err)
		}

		targetPath, err := safeExtractPath(destination, header.Name)
		if err != nil {
			return err
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(targetPath, os.FileMode(header.Mode)); err != nil {
				return fmt.Errorf("create extracted directory: %w", err)
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
				return fmt.Errorf("create extracted parent directory: %w", err)
			}
			if err := writeFromReader(targetPath, reader, os.FileMode(header.Mode)); err != nil {
				return err
			}
		}
	}
}

func extractZip(archivePath string, destination string) error {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return fmt.Errorf("open zip archive: %w", err)
	}
	defer reader.Close()

	for _, file := range reader.File {
		targetPath, err := safeExtractPath(destination, file.Name)
		if err != nil {
			return err
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, file.Mode()); err != nil {
				return fmt.Errorf("create extracted directory: %w", err)
			}
			continue
		}

		handle, err := file.Open()
		if err != nil {
			return fmt.Errorf("open zip entry: %w", err)
		}

		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			handle.Close()
			return fmt.Errorf("create extracted parent directory: %w", err)
		}
		if err := writeFromReader(targetPath, handle, file.Mode()); err != nil {
			handle.Close()
			return err
		}
		if err := handle.Close(); err != nil {
			return fmt.Errorf("close zip entry: %w", err)
		}
	}

	return nil
}

func locateReleaseRoot(stagingRoot string) (string, error) {
	if err := validateReleaseLayout(stagingRoot); err == nil {
		return stagingRoot, nil
	}

	entries, err := os.ReadDir(stagingRoot)
	if err != nil {
		return "", fmt.Errorf("read staging root: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		candidate := filepath.Join(stagingRoot, entry.Name())
		if err := validateReleaseLayout(candidate); err == nil {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("could not find extracted FastNote release root in %s", stagingRoot)
}

func validateReleaseLayout(root string) error {
	requiredPaths := []string{
		filepath.Join(root, binaryName()),
		filepath.Join(root, "backend"),
		filepath.Join(root, "backend", pocketbaseBinaryName()),
		filepath.Join(root, "backend", "pb_hooks"),
		filepath.Join(root, "backend", "pb_migrations"),
		filepath.Join(root, "backend", "pb_public"),
		filepath.Join(root, "version.json"),
	}

	for _, required := range requiredPaths {
		if _, err := os.Stat(required); err != nil {
			return fmt.Errorf("release layout missing %s: %w", required, err)
		}
	}

	return nil
}

func prepareBackupDir(path string) error {
	if err := os.RemoveAll(path); err != nil {
		return fmt.Errorf("reset backup directory: %w", err)
	}
	if err := os.MkdirAll(path, 0o755); err != nil {
		return fmt.Errorf("create backup directory: %w", err)
	}

	return nil
}

func backupCurrentItem(source string, destination string) error {
	info, err := os.Stat(source)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("stat current item %s: %w", source, err)
	}

	if info.IsDir() {
		return copyDir(source, destination)
	}

	return copyPath(source, destination)
}

func switchManagedItems(stagedRoot string, installRoot string, items []managedItem) error {
	for _, item := range items {
		source := filepath.Join(stagedRoot, item.Name)
		if _, err := os.Stat(source); err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return fmt.Errorf("stat staged item %s: %w", source, err)
		}

		destination := filepath.Join(installRoot, item.Name)
		if err := os.RemoveAll(destination); err != nil {
			return fmt.Errorf("remove current item %s: %w", destination, err)
		}
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			return fmt.Errorf("create destination parent %s: %w", destination, err)
		}
		if err := os.Rename(source, destination); err != nil {
			if item.Kind == "dir" {
				if err := copyDir(source, destination); err != nil {
					return err
				}
			} else {
				if err := copyPath(source, destination); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func restoreBackup(installRoot string, backupDir string, items []managedItem) error {
	for _, item := range items {
		backupPath := filepath.Join(backupDir, item.Name)
		info, err := os.Stat(backupPath)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return fmt.Errorf("stat backup item %s: %w", backupPath, err)
		}

		target := filepath.Join(installRoot, item.Name)
		if err := os.RemoveAll(target); err != nil {
			return fmt.Errorf("remove broken item %s: %w", target, err)
		}
		if info.IsDir() {
			if err := copyDir(backupPath, target); err != nil {
				return err
			}
		} else {
			if err := copyPath(backupPath, target); err != nil {
				return err
			}
		}
	}

	return nil
}

func managedItems() []managedItem {
	return []managedItem{
		{Name: binaryName(), Kind: "file"},
		{Name: "backend", Kind: "dir"},
		{Name: "version.json", Kind: "file"},
		{Name: "README.md", Kind: "file"},
	}
}

func binaryName() string {
	if runtime.GOOS == "windows" {
		return "fastnote.exe"
	}
	return "fastnote"
}

func pocketbaseBinaryName() string {
	if runtime.GOOS == "windows" {
		return "pocketbase.exe"
	}
	return "pocketbase"
}

func artifactFileName(artifact Artifact) string {
	if strings.TrimSpace(artifact.FileName) != "" {
		return artifact.FileName
	}
	return filepath.Base(strings.TrimSpace(artifact.URL))
}

func sanitizeVersion(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, "/", "-")
	value = strings.ReplaceAll(value, "\\", "-")
	if value == "" {
		return "unknown"
	}
	return value
}

func safeExtractPath(destination string, name string) (string, error) {
	target := filepath.Join(destination, filepath.Clean(name))
	relative, err := filepath.Rel(destination, target)
	if err != nil {
		return "", fmt.Errorf("resolve extracted path: %w", err)
	}
	if strings.HasPrefix(relative, "..") {
		return "", fmt.Errorf("archive entry escapes destination: %s", name)
	}
	return target, nil
}

func writeFromReader(destination string, reader io.Reader, mode os.FileMode) error {
	tempPath := destination + ".tmp"
	file, err := os.OpenFile(tempPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return fmt.Errorf("create file %s: %w", destination, err)
	}

	if _, err := io.Copy(file, reader); err != nil {
		file.Close()
		return fmt.Errorf("write file %s: %w", destination, err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close file %s: %w", destination, err)
	}
	if err := os.Rename(tempPath, destination); err != nil {
		return fmt.Errorf("rename file %s: %w", destination, err)
	}
	if mode != 0 {
		_ = os.Chmod(destination, mode)
	}
	return nil
}

func copyPath(source string, destination string) error {
	handle, err := os.Open(source)
	if err != nil {
		return fmt.Errorf("open source file %s: %w", source, err)
	}
	defer handle.Close()

	info, err := handle.Stat()
	if err != nil {
		return fmt.Errorf("stat source file %s: %w", source, err)
	}
	if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
		return fmt.Errorf("create destination parent %s: %w", destination, err)
	}

	return writeFromReader(destination, handle, info.Mode())
}

func copyDir(source string, destination string) error {
	info, err := os.Stat(source)
	if err != nil {
		return fmt.Errorf("stat source directory %s: %w", source, err)
	}
	if err := os.MkdirAll(destination, info.Mode()); err != nil {
		return fmt.Errorf("create destination directory %s: %w", destination, err)
	}

	entries, err := os.ReadDir(source)
	if err != nil {
		return fmt.Errorf("read source directory %s: %w", source, err)
	}

	for _, entry := range entries {
		sourcePath := filepath.Join(source, entry.Name())
		destinationPath := filepath.Join(destination, entry.Name())
		if entry.IsDir() {
			if err := copyDir(sourcePath, destinationPath); err != nil {
				return err
			}
			continue
		}
		if err := copyPath(sourcePath, destinationPath); err != nil {
			return err
		}
	}

	return nil
}
