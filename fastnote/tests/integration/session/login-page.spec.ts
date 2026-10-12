import { flushPromises, mount } from '@vue/test-utils'
import Framework7Vue from 'framework7-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '@/pages/login'
import { alertController, loadingController } from '@/shared/ui/f7'

const { login, back, replace } = vi.hoisted(() => ({
  login: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('@/processes/session', () => ({ useAuth: () => ({ login }) }))
vi.mock('@/processes/navigation', () => ({
  useSimpleBackButton: () => ({ backButtonProps: { defaultHref: '/', text: '返回' } }),
}))
vi.mock('@/shared/lib/framework7', () => ({
  useAppRouter: () => ({ back, replace }),
}))

describe('login page with Framework7 controls', () => {
  let wrapper: ReturnType<typeof mount>
  const dismiss = vi.fn()

  beforeEach(() => {
    vi.spyOn(loadingController, 'create').mockResolvedValue({
      present: vi.fn(),
      dismiss,
    } as any)
    wrapper = mount(LoginPage, { global: { plugins: [Framework7Vue] } })
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
  })

  async function fillCredentials() {
    await wrapper.get('#login-email').setValue('reader@example.com')
    await wrapper.get('#login-password').setValue('test-password')
  }

  it('binds library inputs to form submission and returns after successful login', async () => {
    vi.useFakeTimers()
    login.mockResolvedValue({ success: true })

    expect(wrapper.get('button[type="submit"]').classes()).toContain('disabled')
    await fillCredentials()
    expect(wrapper.get('button[type="submit"]').classes()).not.toContain('disabled')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(login).toHaveBeenCalledWith('reader@example.com', 'test-password')
    expect(wrapper.get('[role="status"]').text()).toBe('登录成功！')
    expect(dismiss).toHaveBeenCalledOnce()
    expect(back).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(back).toHaveBeenCalledOnce()
  })

  it('disables controls during login and allows retry after an error', async () => {
    let finishLogin!: (result: { success: boolean, error: string }) => void
    login.mockImplementation(() => new Promise((resolve) => {
      finishLogin = resolve
    }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await fillCredentials()
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect((wrapper.get('#login-email').element as HTMLInputElement).disabled).toBe(true)
    expect((wrapper.get('#login-password').element as HTMLInputElement).disabled).toBe(true)
    expect(wrapper.get('button[type="submit"]').text()).toContain('登录中...')
    await wrapper.get('form').trigger('submit')
    expect(login).toHaveBeenCalledOnce()

    finishLogin({ success: false, error: '邮箱或密码错误' })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('邮箱或密码错误')
    expect((wrapper.get('#login-password').element as HTMLInputElement).disabled).toBe(false)
    expect(wrapper.get('button[type="submit"]').classes()).not.toContain('disabled')
    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('validates empty credentials and opens registration without submitting', async () => {
    const present = vi.fn()
    vi.spyOn(alertController, 'create').mockResolvedValue({ present } as any)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(alertController.create).toHaveBeenCalledWith(expect.objectContaining({
      message: '请输入邮箱和密码',
    }))
    expect(login).not.toHaveBeenCalled()
    expect(present).toHaveBeenCalledOnce()
    await wrapper.get('button[type="button"]').trigger('click')
    expect(replace).toHaveBeenCalledWith('/register')
  })
})
