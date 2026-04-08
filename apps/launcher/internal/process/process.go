package process

import (
	"context"
	"fmt"
	"io"
	"os/exec"
)

type Runner struct {
	cmd *exec.Cmd
}

func Run(ctx context.Context, binaryPath string, workDir string, args []string, stdout io.Writer, stderr io.Writer) error {
	cmd := exec.CommandContext(ctx, binaryPath, args...)
	cmd.Dir = workDir
	cmd.Stdout = stdout
	cmd.Stderr = stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("run child process: %w", err)
	}

	return nil
}

func Start(ctx context.Context, binaryPath string, workDir string, args []string, stdout io.Writer, stderr io.Writer) (*Runner, error) {
	cmd := exec.CommandContext(ctx, binaryPath, args...)
	cmd.Dir = workDir
	cmd.Stdout = stdout
	cmd.Stderr = stderr

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start child process: %w", err)
	}

	return &Runner{cmd: cmd}, nil
}

func (r *Runner) PID() int {
	if r == nil || r.cmd == nil || r.cmd.Process == nil {
		return 0
	}

	return r.cmd.Process.Pid
}

func (r *Runner) Wait() error {
	if r == nil || r.cmd == nil {
		return nil
	}

	return r.cmd.Wait()
}

func (r *Runner) Stop() error {
	if r == nil || r.cmd == nil || r.cmd.Process == nil {
		return nil
	}

	return r.cmd.Process.Kill()
}
