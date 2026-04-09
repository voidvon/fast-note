//go:build !windows

package runstate

import "syscall"

func isPIDAlive(pid int) (bool, error) {
	if pid <= 0 {
		return false, nil
	}

	err := syscall.Kill(pid, 0)
	if err == nil {
		return true, nil
	}
	if err == syscall.ESRCH {
		return false, nil
	}
	if err == syscall.EPERM {
		return true, nil
	}

	return false, err
}
