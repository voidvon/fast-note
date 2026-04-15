package bootstrap

import (
	"embed"
	"io/fs"
)

//go:embed all:pb_public
var embeddedStaticFiles embed.FS

func resolveEmbeddedStaticFS() (fs.FS, bool) {
	staticFS, err := fs.Sub(embeddedStaticFiles, "pb_public")
	if err != nil {
		return nil, false
	}

	if _, err := fs.Stat(staticFS, "index.html"); err != nil {
		return nil, false
	}

	return staticFS, true
}
