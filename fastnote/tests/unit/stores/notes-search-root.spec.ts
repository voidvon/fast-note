import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { NOTE_TYPE } from '@/shared/types'
import { makeNote } from '../../factories/note.factory'

describe('notes root search', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('finds root and nested notes when searching from home', async () => {
    const { useNote } = await import('@/entities/note')
    type NoteStore = ReturnType<typeof useNote>
    let noteStore: NoteStore | null = null

    const wrapper = mount(defineComponent({
      setup() {
        noteStore = useNote()
        return () => null
      },
    }))

    const { addNote, searchNotesByParentId } = noteStore!

    addNote(makeNote({
      id: 'root-note',
      title: '首页搜索关键字-根目录',
      parent_id: '',
      content: '与搜索无关的正文',
    }))

    addNote(makeNote({
      id: 'folder-1',
      title: '工作',
      item_type: NOTE_TYPE.FOLDER,
      parent_id: '',
      content: '',
    }))

    addNote(makeNote({
      id: 'nested-note',
      title: '子目录笔记',
      parent_id: 'folder-1',
      content: '首页搜索关键字-子目录',
    }))

    const results = await searchNotesByParentId('', '全部', '首页搜索关键字')

    expect(results.map(note => note.id)).toEqual(expect.arrayContaining(['root-note', 'nested-note']))
    expect(results).toHaveLength(2)

    wrapper.unmount()
  })

  it('uses one shared search path for multi-term and folder-semantic matches', async () => {
    const { useNote } = await import('@/entities/note')
    type NoteStore = ReturnType<typeof useNote>
    let noteStore: NoteStore | null = null

    const wrapper = mount(defineComponent({
      setup() {
        noteStore = useNote()
        return () => null
      },
    }))

    const { addNote, searchNotes } = noteStore!

    addNote(makeNote({
      id: 'health-folder',
      title: '健康',
      item_type: NOTE_TYPE.FOLDER,
      parent_id: '',
      content: '',
    }))

    addNote(makeNote({
      id: 'dermatitis-note',
      title: '皮炎诊断',
      parent_id: 'health-folder',
      content: '诊断结果，皮炎',
    }))

    addNote(makeNote({
      id: 'medicine-note',
      title: '前沿药物',
      parent_id: 'health-folder',
      content: '替尔泊肽与英克司兰',
    }))

    addNote(makeNote({
      id: 'sleep-note',
      title: '睡眠记录',
      parent_id: '',
      content: '最近睡眠一般',
    }))

    const results = await searchNotes('健康 睡眠')

    expect(results.map(note => note.id)).toEqual([
      'dermatitis-note',
      'medicine-note',
      'sleep-note',
    ])
    expect(results.map(note => note.folderName)).toEqual([
      '健康',
      '健康',
      '全部',
    ])

    wrapper.unmount()
  })
})
