import type { Ref } from 'vue'
import { computed, ref } from 'vue'

export interface DesktopPaneWidths {
  navigation: number
  noteList: number
}

export interface DesktopPaneLayoutPreference extends DesktopPaneWidths {
  version: 1
}

export const DESKTOP_PANE_LAYOUT_STORAGE_KEY = 'fastnote_desktop_pane_layout_v1'

export const DESKTOP_PANE_LAYOUT_DEFAULTS: DesktopPaneWidths = {
  navigation: 361,
  noteList: 361,
}

export const DESKTOP_PANE_LAYOUT_LIMITS = {
  navigation: { min: 240, max: 420 },
  noteList: { min: 280, max: 520 },
  detail: { min: 420 },
} as const

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeWidth(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback
}

export function normalizeDesktopPaneLayoutPreference(value: unknown): DesktopPaneLayoutPreference | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<DesktopPaneLayoutPreference>
  if (candidate.version !== 1) {
    return null
  }

  if (
    typeof candidate.navigation !== 'number'
    || !Number.isFinite(candidate.navigation)
    || typeof candidate.noteList !== 'number'
    || !Number.isFinite(candidate.noteList)
  ) {
    return null
  }

  return {
    version: 1,
    navigation: clamp(
      candidate.navigation,
      DESKTOP_PANE_LAYOUT_LIMITS.navigation.min,
      DESKTOP_PANE_LAYOUT_LIMITS.navigation.max,
    ),
    noteList: clamp(
      candidate.noteList,
      DESKTOP_PANE_LAYOUT_LIMITS.noteList.min,
      DESKTOP_PANE_LAYOUT_LIMITS.noteList.max,
    ),
  }
}

function resolveMaximumSideTotal(containerWidth: number) {
  const minimumSideTotal
    = DESKTOP_PANE_LAYOUT_LIMITS.navigation.min + DESKTOP_PANE_LAYOUT_LIMITS.noteList.min

  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return Number.POSITIVE_INFINITY
  }

  const availableDetailWidth = Math.max(0, containerWidth - minimumSideTotal)
  const reservedDetailWidth = Math.min(DESKTOP_PANE_LAYOUT_LIMITS.detail.min, availableDetailWidth)
  return Math.max(minimumSideTotal, containerWidth - reservedDetailWidth)
}

export function resolveDesktopPaneWidths(
  preference: DesktopPaneWidths,
  containerWidth: number,
): DesktopPaneWidths {
  let navigation = normalizeWidth(
    preference.navigation,
    DESKTOP_PANE_LAYOUT_DEFAULTS.navigation,
    DESKTOP_PANE_LAYOUT_LIMITS.navigation.min,
    DESKTOP_PANE_LAYOUT_LIMITS.navigation.max,
  )
  let noteList = normalizeWidth(
    preference.noteList,
    DESKTOP_PANE_LAYOUT_DEFAULTS.noteList,
    DESKTOP_PANE_LAYOUT_LIMITS.noteList.min,
    DESKTOP_PANE_LAYOUT_LIMITS.noteList.max,
  )

  const maximumSideTotal = resolveMaximumSideTotal(containerWidth)
  const excess = navigation + noteList - maximumSideTotal
  if (excess <= 0) {
    return { navigation, noteList }
  }

  const navigationCapacity = navigation - DESKTOP_PANE_LAYOUT_LIMITS.navigation.min
  const noteListCapacity = noteList - DESKTOP_PANE_LAYOUT_LIMITS.noteList.min
  const totalCapacity = navigationCapacity + noteListCapacity

  if (totalCapacity <= 0) {
    return { navigation, noteList }
  }

  const navigationReduction = Math.min(excess * navigationCapacity / totalCapacity, navigationCapacity)
  navigation -= navigationReduction
  noteList -= Math.min(excess - navigationReduction, noteListCapacity)

  return { navigation, noteList }
}

function resolveStorage(storage?: Storage | null) {
  if (storage !== undefined) {
    return storage
  }

  return typeof localStorage === 'undefined' ? null : localStorage
}

function readPreference(storage: Storage | null): DesktopPaneLayoutPreference | null {
  if (!storage) {
    return null
  }

  try {
    const serialized = storage.getItem(DESKTOP_PANE_LAYOUT_STORAGE_KEY)
    if (!serialized) {
      return null
    }

    const preference = normalizeDesktopPaneLayoutPreference(JSON.parse(serialized))
    if (!preference) {
      storage.removeItem(DESKTOP_PANE_LAYOUT_STORAGE_KEY)
    }
    return preference
  }
  catch {
    storage.removeItem(DESKTOP_PANE_LAYOUT_STORAGE_KEY)
    return null
  }
}

export function useDesktopPaneLayout(containerWidth: Ref<number>, storage?: Storage | null) {
  const resolvedStorage = resolveStorage(storage)
  const storedPreference = readPreference(resolvedStorage)
  const preferredNavigationWidth = ref(
    storedPreference?.navigation ?? DESKTOP_PANE_LAYOUT_DEFAULTS.navigation,
  )
  const preferredNoteListWidth = ref(
    storedPreference?.noteList ?? DESKTOP_PANE_LAYOUT_DEFAULTS.noteList,
  )

  const widths = computed(() => resolveDesktopPaneWidths({
    navigation: preferredNavigationWidth.value,
    noteList: preferredNoteListWidth.value,
  }, containerWidth.value))

  const maximumSideTotal = computed(() => resolveMaximumSideTotal(containerWidth.value))
  const navigationMax = computed(() => Math.max(
    DESKTOP_PANE_LAYOUT_LIMITS.navigation.min,
    Math.min(
      DESKTOP_PANE_LAYOUT_LIMITS.navigation.max,
      maximumSideTotal.value - widths.value.noteList,
    ),
  ))
  const noteListMax = computed(() => Math.max(
    DESKTOP_PANE_LAYOUT_LIMITS.noteList.min,
    Math.min(
      DESKTOP_PANE_LAYOUT_LIMITS.noteList.max,
      maximumSideTotal.value - widths.value.navigation,
    ),
  ))

  function setNavigationWidth(value: number) {
    preferredNavigationWidth.value = clamp(
      value,
      DESKTOP_PANE_LAYOUT_LIMITS.navigation.min,
      navigationMax.value,
    )
  }

  function setNoteListWidth(value: number) {
    preferredNoteListWidth.value = clamp(
      value,
      DESKTOP_PANE_LAYOUT_LIMITS.noteList.min,
      noteListMax.value,
    )
  }

  function persist() {
    if (!resolvedStorage) {
      return
    }

    resolvedStorage.setItem(DESKTOP_PANE_LAYOUT_STORAGE_KEY, JSON.stringify({
      version: 1,
      navigation: preferredNavigationWidth.value,
      noteList: preferredNoteListWidth.value,
    } satisfies DesktopPaneLayoutPreference))
  }

  function resetNavigationWidth() {
    preferredNavigationWidth.value = DESKTOP_PANE_LAYOUT_DEFAULTS.navigation
    persist()
  }

  function resetNoteListWidth() {
    preferredNoteListWidth.value = DESKTOP_PANE_LAYOUT_DEFAULTS.noteList
    persist()
  }

  return {
    navigationMax,
    navigationMin: DESKTOP_PANE_LAYOUT_LIMITS.navigation.min,
    navigationWidth: computed({
      get: () => widths.value.navigation,
      set: setNavigationWidth,
    }),
    noteListMax,
    noteListMin: DESKTOP_PANE_LAYOUT_LIMITS.noteList.min,
    noteListWidth: computed({
      get: () => widths.value.noteList,
      set: setNoteListWidth,
    }),
    persist,
    resetNavigationWidth,
    resetNoteListWidth,
  }
}
