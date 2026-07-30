export async function preparePersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { persistent: null, usage: null, quota: null }
  }

  const persistent = navigator.storage.persist
    ? await navigator.storage.persist().catch(() => false)
    : null
  const estimate: StorageEstimate = navigator.storage.estimate
    ? await navigator.storage.estimate().catch(() => ({}))
    : {}

  return {
    persistent,
    usage: estimate.usage ?? null,
    quota: estimate.quota ?? null,
  }
}
