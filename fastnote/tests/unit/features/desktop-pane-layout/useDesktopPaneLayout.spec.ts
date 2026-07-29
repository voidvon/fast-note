import { beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import {
  DESKTOP_PANE_LAYOUT_DEFAULTS,
  DESKTOP_PANE_LAYOUT_STORAGE_KEY,
  normalizeDesktopPaneLayoutPreference,
  resolveDesktopPaneWidths,
  useDesktopPaneLayout,
} from '@/features/desktop-pane-layout'

describe('desktop pane layout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps the default widths when the detail pane has enough room', () => {
    expect(resolveDesktopPaneWidths(DESKTOP_PANE_LAYOUT_DEFAULTS, 1440)).toEqual({
      navigation: 361,
      noteList: 361,
    })
  })

  it('shrinks both side panes while reserving detail space', () => {
    const widths = resolveDesktopPaneWidths(DESKTOP_PANE_LAYOUT_DEFAULTS, 1000)

    expect(widths.navigation).toBeGreaterThanOrEqual(240)
    expect(widths.noteList).toBeGreaterThanOrEqual(280)
    expect(widths.navigation + widths.noteList).toBeCloseTo(580)
  })

  it('uses side-pane minimums when the desktop viewport is narrow', () => {
    expect(resolveDesktopPaneWidths(DESKTOP_PANE_LAYOUT_DEFAULTS, 640)).toEqual({
      navigation: 240,
      noteList: 280,
    })
  })

  it('rejects unknown persisted versions and clamps valid values', () => {
    expect(normalizeDesktopPaneLayoutPreference({
      version: 2,
      navigation: 300,
      noteList: 300,
    })).toBeNull()
    expect(normalizeDesktopPaneLayoutPreference({
      version: 1,
      navigation: 100,
      noteList: 900,
    })).toEqual({
      version: 1,
      navigation: 240,
      noteList: 520,
    })
  })

  it('persists device-local preferences and restores them', () => {
    const containerWidth = ref(1440)
    const layout = useDesktopPaneLayout(containerWidth, localStorage)

    layout.navigationWidth.value = 400
    layout.noteListWidth.value = 480
    layout.persist()

    expect(JSON.parse(localStorage.getItem(DESKTOP_PANE_LAYOUT_STORAGE_KEY) || '')).toEqual({
      version: 1,
      navigation: 400,
      noteList: 480,
    })

    const restored = useDesktopPaneLayout(containerWidth, localStorage)
    expect(restored.navigationWidth.value).toBe(400)
    expect(restored.noteListWidth.value).toBe(480)
  })

  it('temporarily clamps widths on a smaller window without losing the preference', () => {
    const containerWidth = ref(1440)
    const layout = useDesktopPaneLayout(containerWidth, localStorage)
    layout.navigationWidth.value = 400
    layout.noteListWidth.value = 480

    containerWidth.value = 1000
    expect(layout.navigationWidth.value + layout.noteListWidth.value).toBeCloseTo(580)

    containerWidth.value = 1440
    expect(layout.navigationWidth.value).toBe(400)
    expect(layout.noteListWidth.value).toBe(480)
  })

  it('removes malformed persisted data', () => {
    localStorage.setItem(DESKTOP_PANE_LAYOUT_STORAGE_KEY, '{bad-json')

    const layout = useDesktopPaneLayout(ref(1440), localStorage)

    expect(layout.navigationWidth.value).toBe(DESKTOP_PANE_LAYOUT_DEFAULTS.navigation)
    expect(localStorage.getItem(DESKTOP_PANE_LAYOUT_STORAGE_KEY)).toBeNull()
  })
})
