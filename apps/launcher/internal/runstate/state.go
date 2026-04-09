package runstate

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type State struct {
	LauncherPID   int    `json:"launcherPid"`
	PocketBasePID int    `json:"pocketbasePid"`
	HTTPAddr      string `json:"httpAddr"`
	StartedAt     string `json:"startedAt"`
}

func EnsureAvailable(path string, currentPID int) error {
	state, exists, err := Load(path)
	if err != nil {
		return err
	}
	if !exists {
		return nil
	}
	if state.LauncherPID == currentPID {
		return nil
	}

	alive, err := isPIDAlive(state.LauncherPID)
	if err != nil {
		return fmt.Errorf("check launcher pid %d: %w", state.LauncherPID, err)
	}
	if alive {
		return fmt.Errorf("FastNote is already running (launcher pid=%d addr=%s)", state.LauncherPID, state.HTTPAddr)
	}

	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove stale runtime state: %w", err)
	}

	return nil
}

func Save(path string, state State) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create runtime state directory: %w", err)
	}

	if state.StartedAt == "" {
		state.StartedAt = time.Now().Format(time.RFC3339)
	}

	content, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal runtime state: %w", err)
	}

	if err := os.WriteFile(path, content, 0o644); err != nil {
		return fmt.Errorf("write runtime state: %w", err)
	}

	return nil
}

func Remove(path string) error {
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove runtime state: %w", err)
	}

	return nil
}

func Load(path string) (State, bool, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return State{}, false, nil
		}
		return State{}, false, fmt.Errorf("read runtime state: %w", err)
	}

	var state State
	if err := json.Unmarshal(content, &state); err != nil {
		return State{}, false, fmt.Errorf("parse runtime state: %w", err)
	}

	return state, true, nil
}

func Active(path string) (State, bool, error) {
	state, exists, err := Load(path)
	if err != nil || !exists {
		return state, exists, err
	}

	alive, err := isPIDAlive(state.LauncherPID)
	if err != nil {
		return State{}, false, fmt.Errorf("check launcher pid %d: %w", state.LauncherPID, err)
	}
	if !alive {
		if err := Remove(path); err != nil {
			return State{}, false, err
		}
		return State{}, false, nil
	}

	return state, true, nil
}
