package cli

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"strings"

	"github.com/coder-virjay/fast-note/apps/launcher/internal/bootstrap"
	"github.com/coder-virjay/fast-note/apps/launcher/internal/config"
	"github.com/coder-virjay/fast-note/apps/launcher/internal/runstate"
	"github.com/coder-virjay/fast-note/apps/launcher/internal/update"
	versioninfo "github.com/coder-virjay/fast-note/apps/launcher/internal/version"
)

func Run(ctx context.Context, args []string, stdout io.Writer, stderr io.Writer) error {
	command := "run"
	if len(args) > 0 {
		command = args[0]
	}

	switch command {
	case "run":
		return bootstrap.Run(ctx)
	case "version":
		return runVersion(stdout)
	case "check-update":
		return runCheckUpdate(ctx, stdout, stderr)
	case "update":
		return runUpdate(ctx, stdout, stderr, args[1:])
	case "update-status":
		return runUpdateStatus(stdout)
	case "cleanup-updates":
		return runCleanupUpdates(stdout, stderr, args[1:])
	case "help", "--help", "-h":
		writeUsage(stdout)
		return nil
	default:
		writeUsage(stderr)
		return fmt.Errorf("unknown command %q", command)
	}
}

func runVersion(stdout io.Writer) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	metadata, err := versioninfo.Load(cfg)
	if err != nil {
		return err
	}

	_, err = fmt.Fprintf(
		stdout,
		"FastNote %s\nchannel: %s\nplatform: %s\nPocketBase: %s\nversion source: %s\n",
		metadata.AppVersion,
		metadata.Channel,
		metadata.Platform,
		metadata.PocketBaseVersion,
		metadata.Source,
	)
	if err != nil {
		return err
	}

	if metadata.BuiltAt != "" {
		if _, err := fmt.Fprintf(stdout, "built at: %s\n", metadata.BuiltAt); err != nil {
			return err
		}
	}
	if metadata.Commit != "" {
		if _, err := fmt.Fprintf(stdout, "commit: %s\n", metadata.Commit); err != nil {
			return err
		}
	}
	if manifestURL := versioninfo.ResolveManifestURL(metadata); manifestURL != "" {
		if _, err := fmt.Fprintf(stdout, "manifest: %s\n", manifestURL); err != nil {
			return err
		}
	}

	return nil
}

func runCheckUpdate(ctx context.Context, stdout io.Writer, stderr io.Writer) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	metadata, err := versioninfo.Load(cfg)
	if err != nil {
		return err
	}

	result, err := update.Check(ctx, metadata)
	if err != nil {
		maybeWriteManifestHint(stderr, err)
		return err
	}

	if result.HasUpdate {
		if _, err := fmt.Fprintf(
			stdout,
			"Update available: %s -> %s\nchannel: %s\nmanifest: %s\n",
			result.CurrentVersion,
			result.LatestVersion,
			result.Channel,
			result.ManifestURL,
		); err != nil {
			return err
		}
		if result.Artifact.URL != "" {
			if _, err := fmt.Fprintf(stdout, "artifact: %s\n", result.Artifact.URL); err != nil {
				return err
			}
		}
		if result.NotesURL != "" {
			if _, err := fmt.Fprintf(stdout, "release notes: %s\n", result.NotesURL); err != nil {
				return err
			}
		}

		return nil
	}

	_, err = fmt.Fprintf(
		stdout,
		"Already up to date: %s\nchannel: %s\nmanifest: %s\n",
		result.CurrentVersion,
		result.Channel,
		result.ManifestURL,
	)

	return err
}

func runUpdateStatus(stdout io.Writer) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	metadata, err := versioninfo.Load(cfg)
	if err != nil {
		return err
	}

	runtimeState, running, err := runstate.Active(cfg.RuntimeStateFile)
	if err != nil {
		return err
	}

	status, err := update.LoadStatus(cfg)
	if err != nil {
		return err
	}

	if _, err := fmt.Fprintf(stdout, "Current version: %s\n", metadata.AppVersion); err != nil {
		return err
	}
	if running {
		if _, err := fmt.Fprintf(stdout, "Runtime: running (launcher pid=%d pocketbase pid=%d addr=%s)\n", runtimeState.LauncherPID, runtimeState.PocketBasePID, runtimeState.HTTPAddr); err != nil {
			return err
		}
	} else {
		if _, err := fmt.Fprintln(stdout, "Runtime: stopped"); err != nil {
			return err
		}
	}

	if !status.HasState {
		_, err = fmt.Fprintln(stdout, "Last update: none")
		return err
	}

	_, err = fmt.Fprintf(
		stdout,
		"Last update: %s -> %s (%s)\nartifact: %s\n",
		status.UpdateState.FromVersion,
		status.UpdateState.ToVersion,
		status.UpdateState.Status,
		status.UpdateState.ArtifactURL,
	)
	return err
}

func runCleanupUpdates(stdout io.Writer, stderr io.Writer, args []string) error {
	fs := flag.NewFlagSet("cleanup-updates", flag.ContinueOnError)
	fs.SetOutput(stderr)

	keep := fs.Int("keep", 2, "number of most recent update caches to keep")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	result, err := update.Cleanup(cfg, *keep)
	if err != nil {
		return err
	}

	removed := "none"
	if len(result.Removed) > 0 {
		removed = joinCSV(result.Removed)
	}
	kept := "none"
	if len(result.Kept) > 0 {
		kept = joinCSV(result.Kept)
	}

	_, err = fmt.Fprintf(stdout, "Removed update caches: %s\nKept update caches: %s\n", removed, kept)
	return err
}

func runUpdate(ctx context.Context, stdout io.Writer, stderr io.Writer, args []string) error {
	fs := flag.NewFlagSet("update", flag.ContinueOnError)
	fs.SetOutput(stderr)

	targetVersion := fs.String("version", "", "install the specified version from the manifest")
	dryRun := fs.Bool("dry-run", false, "download, verify and stage the update without switching files")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	metadata, err := versioninfo.Load(cfg)
	if err != nil {
		return err
	}

	result, err := update.Apply(ctx, cfg, metadata, update.ApplyOptions{
		TargetVersion: *targetVersion,
		DryRun:        *dryRun,
	})
	if err != nil {
		maybeWriteManifestHint(stderr, err)
		return err
	}

	if result.CurrentVersion == result.TargetVersion && *targetVersion == "" {
		_, err = fmt.Fprintf(stdout, "Already up to date: %s\n", result.CurrentVersion)
		return err
	}

	if result.DryRun {
		_, err = fmt.Fprintf(
			stdout,
			"Update staged: %s -> %s\nartifact: %s\nbackup dir: %s\n",
			result.CurrentVersion,
			result.TargetVersion,
			result.ArtifactURL,
			result.BackupDir,
		)
		return err
	}

	_, err = fmt.Fprintf(
		stdout,
		"Update applied: %s -> %s\nartifact: %s\nbackup dir: %s\n",
		result.CurrentVersion,
		result.TargetVersion,
		result.ArtifactURL,
		result.BackupDir,
	)

	return err
}

func writeUsage(out io.Writer) {
	_, _ = fmt.Fprintln(out, "Usage:")
	_, _ = fmt.Fprintln(out, "  fastnote             Start PocketBase and serve FastNote")
	_, _ = fmt.Fprintln(out, "  fastnote run         Start PocketBase and serve FastNote")
	_, _ = fmt.Fprintln(out, "  fastnote version     Print app and runtime version metadata")
	_, _ = fmt.Fprintln(out, "  fastnote check-update Check update manifest for a newer version")
	_, _ = fmt.Fprintln(out, "  fastnote update [--dry-run] [--version X.Y.Z]  Apply the update from the manifest")
	_, _ = fmt.Fprintln(out, "  fastnote update-status  Show runtime state and the last update result")
	_, _ = fmt.Fprintln(out, "  fastnote cleanup-updates [--keep N]  Remove older update caches")
}

func writeUsageHint(out io.Writer) {
	_, _ = fmt.Fprintln(out, "Hint: configure FASTNOTE_UPDATE_MANIFEST_URL or set manifestUrl in version.json.")
}

func joinCSV(values []string) string {
	return strings.Join(values, ", ")
}

func maybeWriteManifestHint(out io.Writer, err error) {
	if err == nil {
		return
	}

	message := err.Error()
	if strings.Contains(message, "manifest") || strings.Contains(message, "artifact") {
		writeUsageHint(out)
	}
}
