import { ref } from 'vue'

const isDesktop = ref(false)

function updateDeviceType() {
  isDesktop.value = window.innerWidth >= 640
}

updateDeviceType()
window.addEventListener('resize', updateDeviceType)

export function useDeviceType() {
  return { isDesktop }
}
