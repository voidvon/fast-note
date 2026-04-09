package logging

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestNewPocketBaseWritersKeepsRecentLogFiles(t *testing.T) {
	logsDir := t.TempDir()

	for i := 0; i < 24; i++ {
		name := filepath.Join(logsDir, strings.Join([]string{
			"pocketbase-20240101-0000",
			leftPadTwoDigits(i),
			".log",
		}, ""))
		if err := os.WriteFile(name, []byte("old log"), 0o644); err != nil {
			t.Fatalf("WriteFile(%s) failed: %v", name, err)
		}
	}
	if err := os.WriteFile(filepath.Join(logsDir, "not-a-pocketbase.log"), []byte("keep"), 0o644); err != nil {
		t.Fatalf("WriteFile(non-matching log) failed: %v", err)
	}

	_, _, closeLogs, err := NewPocketBaseWriters(logsDir)
	if err != nil {
		t.Fatalf("NewPocketBaseWriters returned error: %v", err)
	}
	defer closeLogs()

	entries, err := os.ReadDir(logsDir)
	if err != nil {
		t.Fatalf("ReadDir(%s) failed: %v", logsDir, err)
	}

	var pocketbaseLogs []string
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), "pocketbase-") && strings.HasSuffix(entry.Name(), ".log") {
			pocketbaseLogs = append(pocketbaseLogs, entry.Name())
		}
	}

	if len(pocketbaseLogs) != maxPocketBaseLogFiles {
		t.Fatalf("expected %d pocketbase logs, got %d (%v)", maxPocketBaseLogFiles, len(pocketbaseLogs), pocketbaseLogs)
	}

	if _, err := os.Stat(filepath.Join(logsDir, "pocketbase-20240101-000000.log")); !os.IsNotExist(err) {
		t.Fatalf("expected oldest log file to be removed, stat err=%v", err)
	}

	if _, err := os.Stat(filepath.Join(logsDir, "not-a-pocketbase.log")); err != nil {
		t.Fatalf("expected non-matching log file to remain, stat err=%v", err)
	}
}

func TestLineLimitedFileWriterKeepsLatest1000Lines(t *testing.T) {
	filePath := filepath.Join(t.TempDir(), "pocketbase.log")
	file, err := os.OpenFile(filePath, os.O_CREATE|os.O_RDWR|os.O_TRUNC, 0o644)
	if err != nil {
		t.Fatalf("OpenFile(%s) failed: %v", filePath, err)
	}
	defer file.Close()

	writer, err := newLineLimitedFileWriter(file, 1000)
	if err != nil {
		t.Fatalf("newLineLimitedFileWriter returned error: %v", err)
	}

	for i := 0; i < 1205; i++ {
		if _, err := writer.Write([]byte("line-" + strconv.Itoa(i) + "\n")); err != nil {
			t.Fatalf("Write(line-%d) failed: %v", i, err)
		}
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("ReadFile(%s) failed: %v", filePath, err)
	}

	lines := strings.Split(strings.TrimSuffix(string(content), "\n"), "\n")
	if len(lines) != 1000 {
		t.Fatalf("expected 1000 lines, got %d", len(lines))
	}
	if lines[0] != "line-205" {
		t.Fatalf("expected first remaining line to be line-205, got %q", lines[0])
	}
	if lines[len(lines)-1] != "line-1204" {
		t.Fatalf("expected last remaining line to be line-1204, got %q", lines[len(lines)-1])
	}
}

func leftPadTwoDigits(value int) string {
	if value < 10 {
		return "0" + string(rune('0'+value))
	}

	tens := value / 10
	ones := value % 10
	return string([]rune{'0' + rune(tens), '0' + rune(ones)})
}
