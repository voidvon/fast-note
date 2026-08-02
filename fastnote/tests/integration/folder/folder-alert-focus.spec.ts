const { promptMock } = vi.hoisted(() => ({
  promptMock: vi.fn(),
}))

vi.mock('@/shared/ui/f7', () => ({
  dialogController: {
    prompt: promptMock,
  },
}))

describe('folder create Framework7 dialog', () => {
  beforeEach(() => {
    vi.resetModules()
    promptMock.mockReset()
  })

  it('uses the official prompt shortcut with the folder copy', async () => {
    promptMock.mockResolvedValue('工作资料')
    const { promptFolderName } = await import('@/features/note-write/model/prompt-folder-name')

    await expect(promptFolderName()).resolves.toBe('工作资料')
    expect(promptMock).toHaveBeenCalledWith({
      title: '新建文件夹',
      text: '请输入文件夹名称',
      defaultValue: '',
    })
  })

  it('preserves cancellation from the Framework7 prompt', async () => {
    promptMock.mockResolvedValue(null)
    const { promptFolderName } = await import('@/features/note-write/model/prompt-folder-name')

    await expect(promptFolderName()).resolves.toBeNull()
  })
})
