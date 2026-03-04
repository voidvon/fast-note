export function resetTestEnvironment() {
  localStorage.clear()
  sessionStorage.clear()
}

export function createMockFile(
  name: string,
  type: string,
  content = 'mock-content',
): File {
  return new File([content], name, { type })
}
