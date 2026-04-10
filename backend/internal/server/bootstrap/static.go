package bootstrap

import (
	"io/fs"
	"log"
	"os"
	"path/filepath"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func Register(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		staticFS, ok := resolveStaticFS()
		if ok {
			se.Router.GET("/{path...}", apis.Static(staticFS, true))
		} else {
			log.Printf("backend bootstrap: skip static file serving because no frontend dist directory was found")
		}

		return se.Next()
	})
}

func resolveStaticFS() (fs.FS, bool) {
	for _, candidate := range staticDirCandidates() {
		info, err := os.Stat(candidate)
		if err == nil && info.IsDir() {
			return os.DirFS(candidate), true
		}
	}

	if embeddedFS, ok := resolveEmbeddedStaticFS(); ok {
		return embeddedFS, true
	}

	return nil, false
}

func staticDirCandidates() []string {
	candidates := make([]string, 0, 5)

	if customDist := os.Getenv("FASTNOTE_WEB_DIST"); customDist != "" {
		candidates = append(candidates, customDist)
	}

	candidates = append(candidates,
		filepath.Clean("./pb_public"),
		filepath.Clean("../fastnote/dist"),
		filepath.Clean("./internal/server/bootstrap/pb_public"),
	)

	if executablePath, err := os.Executable(); err == nil {
		executableDir := filepath.Dir(executablePath)
		candidates = append(candidates,
			filepath.Join(executableDir, "pb_public"),
			filepath.Join(executableDir, "..", "fastnote", "dist"),
		)
	}

	return candidates
}
