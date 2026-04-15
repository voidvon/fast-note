import { ref } from 'vue'

const visualHeight = ref(0)
const keyboardHeight = ref(0)

export function useVisualViewport(isInit = false) {
  if (window.visualViewport && isInit) {
    window.visualViewport.addEventListener('resize', () => {
      visualHeight.value = window.visualViewport!.height
      if (window.innerHeight - visualHeight.value > 200) {
        document.documentElement.style.height = `${visualHeight.value}px`
        document.body.style.height = `${visualHeight.value}px`
        keyboardHeight.value = window.innerHeight - visualHeight.value
      }
      else {
        restoreHeight()
      }
    })
  }

  function restoreHeight() {
    if (window.visualViewport) {
      document.documentElement.style.height = ''
      document.body.style.height = ''
      keyboardHeight.value = 0
    }
  }

  return {
    visualHeight,
    keyboardHeight,
    restoreHeight,
  }
}
