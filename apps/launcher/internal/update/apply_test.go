package update

import (
	"path/filepath"
	"testing"
)

func TestLocateReleaseRoot(t *testing.T) {
	root := t.TempDir()
	releaseDir := filepath.Join(root, "FastNote")

	mustMkdirAll(t, filepath.Join(releaseDir, "backend", "pb_hooks"))
	mustMkdirAll(t, filepath.Join(releaseDir, "backend", "pb_migrations"))
	mustMkdirAll(t, filepath.Join(releaseDir, "backend", "pb_public"))
	mustWriteFile(t, filepath.Join(releaseDir, binaryName()), []byte("bin"))
	mustWriteFile(t, filepath.Join(releaseDir, "backend", pocketbaseBinaryName()), []byte("pb"))
	mustWriteFile(t, filepath.Join(releaseDir, "version.json"), []byte("{}"))

	located, err := locateReleaseRoot(root)
	if err != nil {
		t.Fatalf("locateReleaseRoot returned error: %v", err)
	}

	if located != releaseDir {
		t.Fatalf("expected %s, got %s", releaseDir, located)
	}
}

func TestValidateReleaseLayoutRejectsMissingVersion(t *testing.T) {
	root := t.TempDir()

	mustMkdirAll(t, filepath.Join(root, "backend", "pb_hooks"))
	mustMkdirAll(t, filepath.Join(root, "backend", "pb_migrations"))
	mustMkdirAll(t, filepath.Join(root, "backend", "pb_public"))
	mustWriteFile(t, filepath.Join(root, binaryName()), []byte("bin"))
	mustWriteFile(t, filepath.Join(root, "backend", pocketbaseBinaryName()), []byte("pb"))

	if err := validateReleaseLayout(root); err == nil {
		t.Fatalf("expected validateReleaseLayout to fail when version.json is missing")
	}
}
