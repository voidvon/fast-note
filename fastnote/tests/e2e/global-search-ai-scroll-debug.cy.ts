describe('global search ai scroll debug', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
    cy.visit('/home')

    cy.window().then((win) => {
      win.localStorage.setItem('ai-chat-settings:guest', JSON.stringify({
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
      }))

      const messages = Array.from({ length: 30 }, (_, index) => ({
        id: `msg-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        text: `scroll debug message ${index} `.repeat(6),
      }))

      win.localStorage.setItem('ai-chat-conversation:guest', JSON.stringify(messages))
    })

    cy.reload()
  })

  it('captures ai scroll container metrics', () => {
    cy.get('.global-search__input').focus()
    cy.get('button[aria-label="切换到 AI 对话"]').click()

    cy.get('.ai-chat-panel ion-content').should('exist')

    cy.get('.ai-chat-panel ion-content').then(($content) => {
      const ionContent = $content.get(0) as HTMLElement & { shadowRoot?: ShadowRoot }
      const scrollEl = ionContent.shadowRoot?.querySelector('.inner-scroll') as HTMLElement | null

      expect(scrollEl, 'ai chat inner scroll element').to.not.equal(null)

      const metrics = {
        clientHeight: scrollEl!.clientHeight,
        scrollHeight: scrollEl!.scrollHeight,
        scrollTop: scrollEl!.scrollTop,
      }

      cy.log(JSON.stringify(metrics))

      expect(metrics.scrollHeight).to.be.greaterThan(metrics.clientHeight)

      scrollEl!.scrollTop = 200
      scrollEl!.dispatchEvent(new Event('scroll', { bubbles: true }))

      expect(scrollEl!.scrollTop).to.be.greaterThan(0)
    })
  })
})
