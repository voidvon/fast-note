import { computed, ref } from 'vue'

export enum ThemeMode {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}

const currentMode = ref<ThemeMode>(ThemeMode.Auto)

type MediaQueryChangeListener = (event: MediaQueryListEvent) => void

const fallbackPrefersDark: MediaQueryList = {
  matches: false,
  media: '(prefers-color-scheme: dark)',
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => true,
} as MediaQueryList

function createPrefersDarkQuery() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return fallbackPrefersDark
  }

  return window.matchMedia('(prefers-color-scheme: dark)')
}

function addMediaQueryChangeListener(query: MediaQueryList, listener: MediaQueryChangeListener) {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener)
    return
  }

  query.addListener?.(listener)
}

function removeMediaQueryChangeListener(query: MediaQueryList, listener: MediaQueryChangeListener) {
  if (typeof query.removeEventListener === 'function') {
    query.removeEventListener('change', listener)
    return
  }

  query.removeListener?.(listener)
}

let prefersDark = createPrefersDarkQuery()

const isDarkMode = computed(() => {
  if (currentMode.value === ThemeMode.Auto) {
    return prefersDark.matches
  }
  return currentMode.value === ThemeMode.Dark
})

function applyDarkMode(isDark: boolean) {
  document.documentElement.classList.toggle('ion-palette-dark', isDark)
}

function handlePrefersDarkChange(mediaQuery: MediaQueryListEvent) {
  if (currentMode.value === ThemeMode.Auto) {
    applyDarkMode(mediaQuery.matches)
  }
}

function setThemeMode(mode: ThemeMode) {
  currentMode.value = mode
  localStorage.setItem('themeMode', mode)

  if (mode === ThemeMode.Auto) {
    applyDarkMode(prefersDark.matches)
  }
  else {
    applyDarkMode(mode === ThemeMode.Dark)
  }
}

function initTheme() {
  const nextPrefersDark = createPrefersDarkQuery()
  removeMediaQueryChangeListener(prefersDark, handlePrefersDarkChange)
  prefersDark = nextPrefersDark
  addMediaQueryChangeListener(prefersDark, handlePrefersDarkChange)

  const savedThemeMode = localStorage.getItem('themeMode') as ThemeMode | null

  if (savedThemeMode && Object.values(ThemeMode).includes(savedThemeMode as ThemeMode)) {
    currentMode.value = savedThemeMode as ThemeMode
  }
  else {
    currentMode.value = ThemeMode.Auto
  }

  if (currentMode.value === ThemeMode.Auto) {
    applyDarkMode(prefersDark.matches)
  }
  else {
    applyDarkMode(currentMode.value === ThemeMode.Dark)
  }
}

export function useTheme() {
  return {
    currentMode,
    isDarkMode,
    ThemeMode,
    setThemeMode,
    initTheme,
  }
}
