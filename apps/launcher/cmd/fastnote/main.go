package main

import (
	"context"
	"log"
	"os"

	"github.com/coder-virjay/fast-note/apps/launcher/internal/bootstrap"
	"github.com/coder-virjay/fast-note/apps/launcher/internal/cli"
)

func main() {
	ctx := context.Background()

	if len(os.Args) == 1 {
		if err := bootstrap.Run(ctx); err != nil {
			log.Printf("fastnote launcher failed: %v", err)
			os.Exit(1)
		}

		return
	}

	if err := cli.Run(ctx, os.Args[1:], os.Stdout, os.Stderr); err != nil {
		log.Printf("fastnote launcher failed: %v", err)
		os.Exit(1)
	}
}
