import type {
  AiNoteToolCall,
  AiNoteToolName,
} from '@/shared/types'

type JsonSchema = {
  [key: string]: unknown
}

type NativeToolMetadataProperty = JsonSchema & {
  type: 'boolean'
  description: string
}

const NATIVE_TOOL_METADATA_PROPERTIES: Record<'confirmed' | 'dryRun' | 'requireConfirmation', NativeToolMetadataProperty> = {
  confirmed: {
    type: 'boolean',
    description: 'Whether the model is explicitly requesting direct execution now.',
  },
  dryRun: {
    type: 'boolean',
    description: 'Whether the tool should only preview the result without committing.',
  },
  requireConfirmation: {
    type: 'boolean',
    description: 'Whether the tool call should require human confirmation before execution.',
  },
}

interface OpenAiNativeToolDefinition {
  function: {
    description: string
    name: AiNoteToolName
    parameters: JsonSchema
  }
  type: 'function'
}

function booleanProperty(description: string) {
  return {
    type: 'boolean',
    description,
  } satisfies JsonSchema
}

function enumStringProperty(values: string[], description: string) {
  return {
    type: 'string',
    enum: values,
    description,
  } satisfies JsonSchema
}

function stringProperty(description: string) {
  return {
    type: 'string',
    description,
  } satisfies JsonSchema
}

const TOOL_NAMES = new Set<AiNoteToolName>([
  'search_notes',
  'get_note_detail',
  'list_folders',
  'create_note',
  'update_note',
  'move_note',
  'delete_note',
  'set_note_lock',
])

function buildObjectSchema(input: {
  description?: string
  properties: Record<string, JsonSchema>
  required?: string[]
}) {
  return {
    type: 'object',
    description: input.description,
    additionalProperties: false,
    properties: input.properties,
    required: input.required || [],
  }
}

function withMutationToolMetadata(properties: Record<string, JsonSchema>) {
  return {
    ...properties,
    confirmed: NATIVE_TOOL_METADATA_PROPERTIES.confirmed,
    requireConfirmation: NATIVE_TOOL_METADATA_PROPERTIES.requireConfirmation,
  }
}

function normalizeToolFlags(value: Record<string, unknown>) {
  return {
    confirmed: value.confirmed === true ? true : undefined,
    requireConfirmation: value.requireConfirmation === true ? true : undefined,
  }
}

function stripToolFlags(value: Record<string, unknown>) {
  const {
    confirmed: _confirmed,
    requireConfirmation: _requireConfirmation,
    ...payload
  } = value

  return payload
}

export const OPENAI_NATIVE_NOTE_TOOLS: OpenAiNativeToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_notes',
      description: 'Search notes by query, optionally within one folder.',
      parameters: buildObjectSchema({
        properties: {
          folderId: stringProperty('Optional folder scope.'),
          query: stringProperty('Search keywords joined as one query string.'),
        },
        required: ['query'],
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_note_detail',
      description: 'Read the full content of a note by ID.',
      parameters: buildObjectSchema({
        properties: {
          noteId: stringProperty('Target note ID.'),
        },
        required: ['noteId'],
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_folders',
      description: 'List folders, optionally under a parent folder.',
      parameters: buildObjectSchema({
        properties: {
          parentId: stringProperty('Optional parent folder ID.'),
        },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_note',
      description: 'Create a note or folder.',
      parameters: buildObjectSchema({
        properties: withMutationToolMetadata({
          contentHtml: stringProperty('Initial HTML content for a note.'),
          kind: enumStringProperty(['note', 'folder'], 'Whether to create a note or a folder.'),
          parentId: stringProperty('Optional parent folder ID.'),
          summary: stringProperty('Optional note summary.'),
          title: stringProperty('Note or folder title.'),
        }),
        required: ['kind', 'title'],
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_note',
      description: 'Update a note title, summary, or content.',
      parameters: buildObjectSchema({
        properties: withMutationToolMetadata({
          contentHtml: stringProperty('HTML content that replaces the note body.'),
          noteId: stringProperty('Target note ID.'),
          summary: stringProperty('Updated note summary.'),
          title: stringProperty('Updated note title.'),
        }),
        required: ['noteId'],
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_note',
      description: 'Move a note into another folder.',
      parameters: buildObjectSchema({
        properties: withMutationToolMetadata({
          noteId: stringProperty('Source note ID.'),
          targetFolderId: stringProperty('Destination folder ID.'),
        }),
        required: ['noteId', 'targetFolderId'],
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_note',
      description: 'Soft-delete a note.',
      parameters: buildObjectSchema({
        properties: withMutationToolMetadata({
          noteId: stringProperty('Target note ID.'),
        }),
        required: ['noteId'],
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_note_lock',
      description: 'Enable or disable note lock.',
      parameters: buildObjectSchema({
        properties: withMutationToolMetadata({
          action: enumStringProperty(['enable', 'disable'], 'Lock action.'),
          biometricEnabled: booleanProperty('Whether biometric unlock should be enabled.'),
          noteId: stringProperty('Target note ID.'),
        }),
        required: ['noteId', 'action'],
      }),
    },
  },
]

export function parseOpenAiNativeToolCall(
  name: string,
  rawArguments: string | undefined,
): AiNoteToolCall | null {
  if (!TOOL_NAMES.has(name as AiNoteToolName)) {
    return null
  }

  let parsedArguments: unknown = {}
  try {
    parsedArguments = rawArguments?.trim() ? JSON.parse(rawArguments) : {}
  }
  catch {
    return null
  }

  if (!parsedArguments || typeof parsedArguments !== 'object' || Array.isArray(parsedArguments)) {
    return null
  }

  const argumentRecord = parsedArguments as Record<string, unknown>
  return {
    tool: name as AiNoteToolName,
    payload: stripToolFlags(argumentRecord) as AiNoteToolCall['payload'],
    ...normalizeToolFlags(argumentRecord),
  } as AiNoteToolCall
}
