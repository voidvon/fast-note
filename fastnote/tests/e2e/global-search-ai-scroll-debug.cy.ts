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
    cy.get('.page-current:not([aria-hidden="true"]) .global-search')
      .filter(':visible')
      .first()
      .within(() => {
        cy.get('.global-search__input input').then(($input) => {
          const input = $input.get(0)
          const styles = getComputedStyle(input)
          expect(styles.display).not.to.equal('none')
          expect(input.getBoundingClientRect().width).to.be.greaterThan(0)
          expect(input.getBoundingClientRect().height).to.be.greaterThan(0)
          cy.wrap(input).as('searchInputBeforeRoute')
        })

        cy.get('.global-search__input input').click().should('be.focused')
      })

    cy.location('search').should('include', 'overlay=search')
    cy.get('.page-current:not([aria-hidden="true"]) .global-search')
      .filter(':visible')
      .first()
      .within(() => {
        cy.get('.global-search__input input').should('be.focused').then(($input) => {
          cy.get('@searchInputBeforeRoute').then(($previousInput) => {
            expect($input.get(0)).to.equal($previousInput.get(0))
          })
        })
        cy.get('button[aria-label="切换到 AI 对话"]').click()
      })

    cy.get('.ai-chat-panel__thread').should('exist')

    cy.get('.ai-chat-panel__thread').then(($content) => {
      const scrollEl = $content.get(0)

      const metrics = {
        clientHeight: scrollEl.clientHeight,
        scrollHeight: scrollEl.scrollHeight,
        scrollTop: scrollEl.scrollTop,
      }

      cy.log(JSON.stringify(metrics))

      expect(metrics.scrollHeight).to.be.greaterThan(metrics.clientHeight)

      scrollEl.scrollTop = 200
      scrollEl.dispatchEvent(new Event('scroll', { bubbles: true }))

      expect(scrollEl.scrollTop).to.be.greaterThan(0)
    })
  })
})
