import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dialogController } from '@/shared/ui/f7'

const { dialogMock, f7Mock } = vi.hoisted(() => {
  const dialogMock = {
    open: vi.fn(),
    close: vi.fn(),
  }
  const f7Mock = {
    dialog: {
      create: vi.fn(() => dialogMock),
      prompt: vi.fn(),
    },
  }
  return { dialogMock, f7Mock }
})

vi.mock('framework7-vue', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>()
  return {
    ...actual,
    f7: f7Mock,
  }
})

describe('dialogController', () => {
  beforeEach(() => {
    f7Mock.dialog.create.mockClear()
    f7Mock.dialog.prompt.mockClear()
    dialogMock.open.mockClear()
    dialogMock.close.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sets close to true by default even if role is cancel and backdropDismiss is false', async () => {
    const cancelHandler = vi.fn()
    const confirmHandler = vi.fn()

    await dialogController.create({
      header: '测试标题',
      message: '测试内容',
      backdropDismiss: false,
      verticalButtons: true,
      buttons: [
        {
          text: '确认',
          handler: confirmHandler,
        },
        {
          text: '取消',
          role: 'cancel',
          handler: cancelHandler,
        },
      ],
    })

    expect(f7Mock.dialog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        verticalButtons: true,
        closeByBackdropClick: false,
        buttons: expect.arrayContaining([
          expect.objectContaining({
            text: '取消',
            close: true,
          }),
          expect.objectContaining({
            text: '确认',
            close: true,
          }),
        ]),
      }),
    )
  })

  it('respects explicit close: false on buttons', async () => {
    await dialogController.create({
      header: '测试标题',
      buttons: [
        {
          text: '保持打开',
          close: false,
        },
      ],
    })

    expect(f7Mock.dialog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        buttons: [
          expect.objectContaining({
            text: '保持打开',
            close: false,
          }),
        ],
      }),
    )
  })
})
