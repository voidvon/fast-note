package update

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/coder-virjay/fast-note/apps/launcher/internal/config"
)

func TestCleanupKeepsNewestAndProtectedVersion(t *testing.T) {
	root := t.TempDir()
	updatesDir := filepath.Join(root, "updates")
	stateFile := filepath.Join(root, "update-state.json")

	mustMkdirAll(t, filepath.Join(updatesDir, "0.1.0"))
	mustMkdirAll(t, filepath.Join(updatesDir, "0.1.1"))
	mustMkdirAll(t, filepath.Join(updatesDir, "0.1.2"))
	mustWriteFile(t, stateFile, []byte(`{"status":"completed","toVersion":"0.1.1"}`))

	now := time.Now()
	mustChtimes(t, filepath.Join(updatesDir, "0.1.0"), now.Add(-3*time.Hour))
	mustChtimes(t, filepath.Join(updatesDir, "0.1.1"), now.Add(-2*time.Hour))
	mustChtimes(t, filepath.Join(updatesDir, "0.1.2"), now.Add(-1*time.Hour))

	result, err := Cleanup(config.Config{
		UpdatesDir:      updatesDir,
		UpdateStateFile: stateFile,
	}, 1)
	if err != nil {
		t.Fatalf("Cleanup returned error: %v", err)
	}

	if len(result.Removed) != 1 || result.Removed[0] != "0.1.0" {
		t.Fatalf("expected only 0.1.0 removed, got %#v", result.Removed)
	}
}
