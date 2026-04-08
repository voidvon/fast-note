package health

import (
	"context"
	"fmt"
	"net"
	"time"
)

func WaitForTCP(ctx context.Context, address string, interval time.Duration) error {
	dialer := net.Dialer{Timeout: 2 * time.Second}

	for {
		conn, err := dialer.DialContext(ctx, "tcp", address)
		if err == nil {
			_ = conn.Close()
			return nil
		}

		select {
		case <-ctx.Done():
			return fmt.Errorf("wait for %s: %w", address, ctx.Err())
		case <-time.After(interval):
		}
	}
}
