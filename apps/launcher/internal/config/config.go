package config

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
)

type Config struct {
	RootDir            string
	BackendDir         string
	DataDir            string
	LogsDir            string
	PublicDir          string
	HooksDir           string
	MigrationsDir      string
	PocketBaseBinary   string
	HTTPAddr           string
	HealthTimeoutSec   int
	HealthIntervalMSec int
}

func Load() (Config, error) {
	executablePath, err := os.Executable()
	if err != nil {
		return Config{}, fmt.Errorf("resolve executable path: %w", err)
	}

	rootDir := filepath.Dir(executablePath)
	backendDir := filepath.Join(rootDir, "backend")
	dataDir := filepath.Join(rootDir, "data")
	logsDir := filepath.Join(rootDir, "logs")

	binaryName := "pocketbase"
	if runtime.GOOS == "windows" {
		binaryName += ".exe"
	}

	return Config{
		RootDir:            rootDir,
		BackendDir:         backendDir,
		DataDir:            dataDir,
		LogsDir:            logsDir,
		PublicDir:          filepath.Join(backendDir, "pb_public"),
		HooksDir:           filepath.Join(backendDir, "pb_hooks"),
		MigrationsDir:      filepath.Join(backendDir, "pb_migrations"),
		PocketBaseBinary:   filepath.Join(backendDir, binaryName),
		HTTPAddr:           getEnv("FASTNOTE_HTTP_ADDR", "127.0.0.1:8090"),
		HealthTimeoutSec:   getEnvInt("FASTNOTE_HEALTH_TIMEOUT_SEC", 30),
		HealthIntervalMSec: getEnvInt("FASTNOTE_HEALTH_INTERVAL_MS", 250),
	}, nil
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}

func getEnvInt(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}

	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}

	return value
}
