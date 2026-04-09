package update

import (
	"fmt"
	"strconv"
	"strings"
)

func parseVersion(raw string) ([]int, error) {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimPrefix(trimmed, "v")
	if trimmed == "" {
		return nil, fmt.Errorf("empty version")
	}

	if index := strings.IndexAny(trimmed, "-+"); index >= 0 {
		trimmed = trimmed[:index]
	}

	parts := strings.Split(trimmed, ".")
	result := make([]int, 0, len(parts))
	for _, part := range parts {
		value, err := strconv.Atoi(part)
		if err != nil {
			return nil, fmt.Errorf("invalid version segment %q", part)
		}

		result = append(result, value)
	}

	return result, nil
}
