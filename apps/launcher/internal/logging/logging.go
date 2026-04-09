package logging

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const maxPocketBaseLogFiles = 20
const maxLinesPerLogFile = 1000

func NewPocketBaseWriters(logsDir string) (io.Writer, io.Writer, func() error, error) {
	if err := os.MkdirAll(logsDir, 0o755); err != nil {
		return nil, nil, nil, fmt.Errorf("create logs directory: %w", err)
	}

	logPath := filepath.Join(logsDir, fmt.Sprintf("pocketbase-%s.log", time.Now().Format("20060102-150405")))
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("open log file: %w", err)
	}
	if err := cleanupOldLogFiles(logsDir, maxPocketBaseLogFiles); err != nil {
		_ = file.Close()
		return nil, nil, nil, err
	}

	limitedWriter, err := newLineLimitedFileWriter(file, maxLinesPerLogFile)
	if err != nil {
		_ = file.Close()
		return nil, nil, nil, err
	}

	stdoutWriter := io.MultiWriter(os.Stdout, limitedWriter)
	stderrWriter := io.MultiWriter(os.Stderr, limitedWriter)

	log.Printf("writing PocketBase logs to %s", logPath)

	return stdoutWriter, stderrWriter, file.Close, nil
}

func cleanupOldLogFiles(logsDir string, keep int) error {
	if keep <= 0 {
		return nil
	}

	matches, err := filepath.Glob(filepath.Join(logsDir, "pocketbase-*.log"))
	if err != nil {
		return fmt.Errorf("list log files: %w", err)
	}
	if len(matches) <= keep {
		return nil
	}

	sort.Slice(matches, func(i, j int) bool {
		return filepath.Base(matches[i]) > filepath.Base(matches[j])
	})

	for _, path := range matches[keep:] {
		if err := os.Remove(path); err != nil {
			return fmt.Errorf("remove old log file %s: %w", path, err)
		}
	}

	return nil
}

type lineLimitedFileWriter struct {
	file     *os.File
	maxLines int
	lines    []string
	pending  string
	mu       sync.Mutex
}

func newLineLimitedFileWriter(file *os.File, maxLines int) (*lineLimitedFileWriter, error) {
	writer := &lineLimitedFileWriter{
		file:     file,
		maxLines: maxLines,
	}

	if err := writer.rewriteLocked(); err != nil {
		return nil, err
	}

	return writer, nil
}

func (w *lineLimitedFileWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	data := w.pending + string(p)
	parts := strings.Split(data, "\n")

	w.pending = parts[len(parts)-1]
	if len(parts) > 1 {
		w.lines = append(w.lines, parts[:len(parts)-1]...)
	}
	if overflow := len(w.lines) - w.maxLines; overflow > 0 {
		w.lines = append([]string(nil), w.lines[overflow:]...)
	}

	if err := w.rewriteLocked(); err != nil {
		return 0, err
	}

	return len(p), nil
}

func (w *lineLimitedFileWriter) rewriteLocked() error {
	content := strings.Join(w.lines, "\n")
	if len(w.lines) > 0 {
		content += "\n"
	}
	content += w.pending

	if err := w.file.Truncate(0); err != nil {
		return fmt.Errorf("truncate log file: %w", err)
	}
	if _, err := w.file.Seek(0, 0); err != nil {
		return fmt.Errorf("seek log file: %w", err)
	}
	if _, err := w.file.WriteString(content); err != nil {
		return fmt.Errorf("rewrite log file: %w", err)
	}

	return nil
}
