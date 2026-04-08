package bootstrap

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os/signal"
	"syscall"
	"time"

	"github.com/coder-virjay/fast-note/apps/launcher/internal/config"
	"github.com/coder-virjay/fast-note/apps/launcher/internal/health"
	"github.com/coder-virjay/fast-note/apps/launcher/internal/logging"
	"github.com/coder-virjay/fast-note/apps/launcher/internal/pocketbase"
	"github.com/coder-virjay/fast-note/apps/launcher/internal/process"
)

func Run(parent context.Context) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	if err := pocketbase.EnsureLayout(cfg); err != nil {
		return err
	}

	stdoutWriter, stderrWriter, closeLogs, err := logging.NewPocketBaseWriters(cfg.LogsDir)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := closeLogs(); closeErr != nil {
			log.Printf("close log file failed: %v", closeErr)
		}
	}()

	ctx, stopSignals := signal.NotifyContext(parent, syscall.SIGINT, syscall.SIGTERM)
	defer stopSignals()

	log.Printf("running PocketBase migrations from %s", cfg.MigrationsDir)

	if err := process.Run(
		ctx,
		cfg.PocketBaseBinary,
		cfg.BackendDir,
		pocketbase.MigrateArgs(cfg),
		stdoutWriter,
		stderrWriter,
	); err != nil {
		return fmt.Errorf("run pocketbase migrations: %w", err)
	}

	runner, err := process.Start(
		ctx,
		cfg.PocketBaseBinary,
		cfg.BackendDir,
		pocketbase.ServeArgs(cfg),
		stdoutWriter,
		stderrWriter,
	)
	if err != nil {
		return err
	}

	log.Printf("started PocketBase pid=%d addr=%s", runner.PID(), cfg.HTTPAddr)

	healthCtx, cancelHealth := context.WithTimeout(ctx, time.Duration(cfg.HealthTimeoutSec)*time.Second)
	defer cancelHealth()

	if err := health.WaitForTCP(healthCtx, cfg.HTTPAddr, time.Duration(cfg.HealthIntervalMSec)*time.Millisecond); err != nil {
		_ = runner.Stop()
		return err
	}

	log.Printf("PocketBase is ready on %s", cfg.HTTPAddr)

	waitErr := runner.Wait()
	if errors.Is(waitErr, context.Canceled) {
		return nil
	}

	if waitErr != nil {
		return fmt.Errorf("pocketbase exited unexpectedly: %w", waitErr)
	}

	return nil
}
