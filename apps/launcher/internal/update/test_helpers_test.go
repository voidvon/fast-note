package update

import (
	"os"
	"testing"
	"time"
)

func mustMkdirAll(t *testing.T, path string) {
	t.Helper()

	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatalf("MkdirAll(%s) failed: %v", path, err)
	}
}

func mustWriteFile(t *testing.T, path string, content []byte) {
	t.Helper()

	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatalf("WriteFile(%s) failed: %v", path, err)
	}
}

func mustChtimes(t *testing.T, path string, mtime time.Time) {
	t.Helper()

	if err := os.Chtimes(path, mtime, mtime); err != nil {
		t.Fatalf("Chtimes(%s) failed: %v", path, err)
	}
}
