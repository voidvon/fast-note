package main

import (
	"context"
	"log"
	"os"

	"github.com/coder-virjay/fast-note/apps/launcher/internal/bootstrap"
)

func main() {
	ctx := context.Background()

	if err := bootstrap.Run(ctx); err != nil {
		log.Printf("fastnote launcher failed: %v", err)
		os.Exit(1)
	}
}
