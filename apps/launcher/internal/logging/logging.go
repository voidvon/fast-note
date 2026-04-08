package logging

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"
)

func NewPocketBaseWriters(logsDir string) (io.Writer, io.Writer, func() error, error) {
	if err := os.MkdirAll(logsDir, 0o755); err != nil {
		return nil, nil, nil, fmt.Errorf("create logs directory: %w", err)
	}

	logPath := filepath.Join(logsDir, fmt.Sprintf("pocketbase-%s.log", time.Now().Format("20060102-150405")))
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("open log file: %w", err)
	}

	stdoutWriter := io.MultiWriter(os.Stdout, file)
	stderrWriter := io.MultiWriter(os.Stderr, file)

	log.Printf("writing PocketBase logs to %s", logPath)

	return stdoutWriter, stderrWriter, file.Close, nil
}
