import { describe, expect, it } from 'vitest'
import { extractAiChatMentionedTargets } from '@/features/ai-chat/model/mentioned-targets'

describe('mentioned targets helpers', () => {
  it('extracts note and folder mentions from message text', () => {
    const targets = extractAiChatMentionedTargets(
      '帮我比较 @周报(/n/note-1) 和 @工作(/f/folder-1)',
      null,
    )

    expect(targets).toEqual([
      {
        id: 'note-1',
        parentId: '',
        routePath: '/n/note-1',
        source: 'message_mention',
        title: '周报',
        type: 'note',
        updated: '',
      },
      {
        id: 'folder-1',
        parentId: '',
        routePath: '/f/folder-1',
        source: 'message_mention',
        title: '工作',
        type: 'folder',
        updated: '',
      },
    ])
  })

  it('deduplicates repeated mentions and prefers context metadata', () => {
    const targets = extractAiChatMentionedTargets(
      '读取 @周报(/n/note-1)，然后再处理 @周报(/n/note-1)',
      {
        activeNote: {
          id: 'note-1',
          title: '真正的周报',
          summary: '',
          parentId: 'folder-1',
          updated: '2026-04-24 09:00:00',
          isDeleted: false,
          isLocked: false,
        },
      },
    )

    expect(targets).toEqual([{
      id: 'note-1',
      parentId: 'folder-1',
      routePath: '/n/note-1',
      source: 'message_mention',
      title: '真正的周报',
      type: 'note',
      updated: '2026-04-24 09:00:00',
    }])
  })
})
