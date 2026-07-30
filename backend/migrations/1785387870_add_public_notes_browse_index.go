package migrations

import (
	"slices"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

const publicNotesBrowseIndex = "CREATE INDEX `idx_notes_public_browse` ON `notes` (`user_id`, `is_public`, `item_type`, `parent_id`, `updated`)"

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("notes")
		if err != nil {
			return err
		}

		if !slices.Contains(collection.Indexes, publicNotesBrowseIndex) {
			collection.Indexes = append(collection.Indexes, publicNotesBrowseIndex)
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("notes")
		if err != nil {
			return err
		}

		collection.Indexes = slices.DeleteFunc(collection.Indexes, func(index string) bool {
			return index == publicNotesBrowseIndex
		})

		return app.Save(collection)
	})
}
