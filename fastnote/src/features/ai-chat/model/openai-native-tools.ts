import type {
  AiNoteToolCall,
  AiNoteToolName,
} from '@/shared/types'

type JsonSchema = Record<string, unknown>

interface NativeToolMetadataProperty {
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

function withToolMetadata(properties: Record<string, JsonSchema>) {
  return {
    ...properties,
    confirmed: NATIVE_TOOL_METADATA_PROPERTIES.confirmed,
    dryRun: NATIVE_TOOL_METADATA_PROPERTIES.dryRun,
    requireConfirmation: NATIVE_TOOL_METADATA_PROPERTIES.requireConfirmation,
  }
}

function normalizeToolFlags(value: Record<string, unknown>) {
  return {
    confirmed: value.confirmed === true ? true : undefined,
    dryRun: value.dryRun === true ? true : undefined,
    requireConfirmation: value.requireConfirmation === true ? true : undefined,
  }
}

function stripToolFlags(value: Record<string, unknown>) {
  const {
    confirmed: _confirmed,
    dryRun: _dryRun,
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
      description: 'Search notes by keywords, optionally limited to a folder.',
      parameters: buildObjectSchema({
        properties: withToolMetadata({
          folderId: {
            type: 'string',
            description: 'Optional folder scope for the search.',
          },
          includeDeleted: {
            type: 'boolean',
            description: 'Whether deleted notes should be included.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of items to return.',
          },
          query: {
            type: 'string',
            description: 'Search keywords joined into one query string.',
          },
        }),
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
        properties: withToolMetadata({
          noteId: {
            type: 'string',
            description: 'Target note ID.',
          },
        }),
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
        properties: withToolMetadata({
          parentId: {
            type: 'string',
            description: 'Optional parent folder ID.',
          },
        }),
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_note',
      description: 'Create a note or folder.',
      parameters: buildObjectSchema({
        properties: withToolMetadata({
          contentHtml: {
            type: 'string',
            description: 'Initial HTML content for a new note.',
          },
          kind: {
            type: 'string',
            enum: ['note', 'folder'],
            description: 'Whether to create a note or a folder.',
          },
          noteId: {
            type: 'string',
            description: 'Optional custom note ID.',
          },
          parentId: {
            type: 'string',
            description: 'Optional parent folder ID.',
          },
          summary: {
            type: 'string',
            description: 'Optional note summary.',
          },
          title: {
            type: 'string',
            description: 'Note or folder title.',
          },
        }),
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_note',
      description: 'Update a note title, summary, content, or append content.',
      parameters: buildObjectSchema({
        properties: withToolMetadata({
          appendContentHtml: {
            type: 'string',
            description: 'HTML content to append to the note.',
          },
          content: {
            type: 'string',
            description: 'Plain text or HTML content for compatibility.',
          },
          contentHtml: {
            type: 'string',
            description: 'HTML content to replace the note body.',
          },
          expectedUpdated: {
            type: 'string',
            description: 'Expected updated timestamp for optimistic concurrency.',
          },
          noteId: {
            type: 'string',
            description: 'Target note ID.',
          },
          parentId: {
            type: 'string',
            description: 'Optional parent folder ID if the tool intends to change the folder.',
          },
          summary: {
            type: 'string',
            description: 'Updated note summary.',
          },
          title: {
            type: 'string',
            description: 'Updated note title.',
          },
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
        properties: withToolMetadata({
          noteId: {
            type: 'string',
            description: 'Source note ID.',
          },
          targetFolderId: {
            type: 'string',
            description: 'Destination folder ID.',
          },
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
        properties: withToolMetadata({
          mode: {
            type: 'string',
            enum: ['soft'],
            description: 'Deletion mode.',
          },
          noteId: {
            type: 'string',
            description: 'Target note ID.',
          },
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
        properties: withToolMetadata({
          action: {
            type: 'string',
            enum: ['enable', 'disable'],
            description: 'Lock action.',
          },
          biometricEnabled: {
            type: 'boolean',
            description: 'Whether biometric unlock should be enabled.',
          },
          noteId: {
            type: 'string',
            description: 'Target note ID.',
          },
        }),
        required: ['noteId', 'action'],
      }),
    },
  },
]

export function buildAiAssistantToolEnvelopeText(calls: AiNoteToolCall[], answer = '') {
  return JSON.stringify({
    mode: 'tool_calls',
    ...(answer.trim() ? { answer: answer.trim() } : {}),
    toolCalls: calls,
  })
}

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
