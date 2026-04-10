package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/pocketbase/pocketbase/tools/osutils"

	"github.com/voidvon/fastnote/backend/internal/server/bootstrap"
	"github.com/voidvon/fastnote/backend/internal/server/hooks"
	_ "github.com/voidvon/fastnote/backend/migrations"
)

func main() {
	app := pocketbase.New()

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: osutils.IsProbablyGoRun(),
	})

	bootstrap.Register(app)
	hooks.Register(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
