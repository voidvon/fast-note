package update

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/coder-virjay/fast-note/apps/launcher/internal/config"
)

type Status struct {
	UpdateState InstallState
	HasState    bool
}

type CleanupResult struct {
	Removed []string
	Kept    []string
}

func LoadStatus(cfg config.Config) (Status, error) {
	content, err := os.ReadFile(cfg.UpdateStateFile)
	if err != nil {
		if os.IsNotExist(err) {
			return Status{}, nil
		}
		return Status{}, fmt.Errorf("read update state: %w", err)
	}

	var state InstallState
	if err := json.Unmarshal(content, &state); err != nil {
		return Status{}, fmt.Errorf("parse update state: %w", err)
	}

	return Status{
		UpdateState: state,
		HasState:    true,
	}, nil
}

func Cleanup(cfg config.Config, keep int) (CleanupResult, error) {
	if keep < 0 {
		keep = 0
	}

	if err := os.MkdirAll(cfg.UpdatesDir, 0o755); err != nil {
		return CleanupResult{}, fmt.Errorf("create updates directory: %w", err)
	}

	status, err := LoadStatus(cfg)
	if err != nil {
		return CleanupResult{}, err
	}

	entries, err := os.ReadDir(cfg.UpdatesDir)
	if err != nil {
		return CleanupResult{}, fmt.Errorf("read updates directory: %w", err)
	}

	type candidate struct {
		name    string
		modTime time.Time
	}

	candidates := make([]candidate, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			return CleanupResult{}, fmt.Errorf("stat update directory %s: %w", entry.Name(), err)
		}

		candidates = append(candidates, candidate{
			name:    entry.Name(),
			modTime: info.ModTime(),
		})
	}

	sort.Slice(candidates, func(left int, right int) bool {
		return candidates[left].modTime.After(candidates[right].modTime)
	})

	protected := map[string]bool{}
	if status.HasState && status.UpdateState.ToVersion != "" {
		protected[sanitizeVersion(status.UpdateState.ToVersion)] = true
	}

	result := CleanupResult{}
	for index, candidate := range candidates {
		if protected[candidate.name] || index < keep {
			result.Kept = append(result.Kept, candidate.name)
			continue
		}

		path := filepath.Join(cfg.UpdatesDir, candidate.name)
		if err := os.RemoveAll(path); err != nil {
			return CleanupResult{}, fmt.Errorf("remove update cache %s: %w", candidate.name, err)
		}
		result.Removed = append(result.Removed, candidate.name)
	}

	return result, nil
}
