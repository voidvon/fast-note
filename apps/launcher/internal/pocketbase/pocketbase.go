package pocketbase

import (
	"fmt"
	"os"

	"github.com/coder-virjay/fast-note/apps/launcher/internal/config"
)

func EnsureLayout(cfg config.Config) error {
	required := []string{
		cfg.BackendDir,
		cfg.PocketBaseBinary,
		cfg.PublicDir,
		cfg.HooksDir,
		cfg.MigrationsDir,
	}

	for _, path := range required {
		if _, err := os.Stat(path); err != nil {
			return fmt.Errorf("required path missing %s: %w", path, err)
		}
	}

	for _, path := range []string{cfg.DataDir, cfg.LogsDir} {
		if err := os.MkdirAll(path, 0o755); err != nil {
			return fmt.Errorf("create directory %s: %w", path, err)
		}
	}

	return nil
}

func ServeArgs(cfg config.Config) []string {
	return []string{
		"serve",
		"--dir", cfg.DataDir,
		"--http", cfg.HTTPAddr,
		"--publicDir", cfg.PublicDir,
		"--hooksDir", cfg.HooksDir,
		"--migrationsDir", cfg.MigrationsDir,
	}
}

func MigrateArgs(cfg config.Config) []string {
	return []string{
		"migrate",
		"up",
		"--dir", cfg.DataDir,
		"--publicDir", cfg.PublicDir,
		"--hooksDir", cfg.HooksDir,
		"--migrationsDir", cfg.MigrationsDir,
	}
}
