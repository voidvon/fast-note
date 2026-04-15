package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
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

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		if err := e.App.RunAppMigrations(); err != nil {
			return err
		}

		if err := e.App.ReloadCachedCollections(); err != nil {
			return err
		}

		if err := e.App.ReloadSettings(); err != nil {
			return err
		}

		return e.Next()
	})

	bootstrap.Register(app)
	hooks.Register(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
