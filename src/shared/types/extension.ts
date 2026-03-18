export interface ExtensionMetadata {
  id: string
  name: string
  description: string
  icon?: string
  path: string
}

export interface Extension extends ExtensionMetadata {
  enabled: boolean
}

export interface ExtensionState {
  extensions: Extension[]
  initialized: boolean
  loadedExtensions: Record<string, any>
}
