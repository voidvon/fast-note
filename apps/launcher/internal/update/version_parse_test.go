package update

import "testing"

func TestCompareVersions(t *testing.T) {
	t.Run("higher latest version", func(t *testing.T) {
		result, err := compareVersions("0.1.0", "0.1.1")
		if err != nil {
			t.Fatalf("compareVersions returned error: %v", err)
		}
		if result != -1 {
			t.Fatalf("expected -1, got %d", result)
		}
	})

	t.Run("same version ignoring v prefix", func(t *testing.T) {
		result, err := compareVersions("0.1.0", "v0.1.0")
		if err != nil {
			t.Fatalf("compareVersions returned error: %v", err)
		}
		if result != 0 {
			t.Fatalf("expected 0, got %d", result)
		}
	})
}
