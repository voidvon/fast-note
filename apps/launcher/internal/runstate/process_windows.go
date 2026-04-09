//go:build windows

package runstate

func isPIDAlive(pid int) (bool, error) {
	return pid > 0, nil
}
