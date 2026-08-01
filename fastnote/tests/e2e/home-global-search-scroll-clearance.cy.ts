describe('home global search scroll clearance', () => {
  it('reserves the mobile search dock height in the Ionic scroll container', () => {
    cy.viewport(390, 844)
    cy.visit('/home')

    cy.get('.home-navigation-content').then(($content) => {
      const content = $content.get(0)
      const scrollElement = content.shadowRoot?.querySelector('.inner-scroll')

      expect(scrollElement, 'Ionic inner scroll element').to.not.equal(null)
      expect(getComputedStyle(scrollElement!).paddingBottom).to.equal('68px')
    })
  })

  it('keeps the Ionic content background when global search gains focus', () => {
    let backgroundBeforeFocus = ''

    cy.viewport(390, 844)
    cy.visit('/home', {
      onBeforeLoad(window) {
        window.localStorage.setItem('themeMode', 'dark')
      },
    })

    cy.get('.home-navigation-content').then(($content) => {
      const content = $content.get(0)
      backgroundBeforeFocus = getComputedStyle(content).getPropertyValue('--background').trim()

      expect(backgroundBeforeFocus).not.to.equal('transparent')
    })

    cy.get('.global-search__input').click()
    cy.get('.global-search__panel-surface--active').should('exist')
    cy.get('.home-navigation-content').should(($content) => {
      const backgroundAfterFocus = getComputedStyle($content.get(0))
        .getPropertyValue('--background')
        .trim()

      expect(backgroundAfterFocus).to.equal(backgroundBeforeFocus)
    })
  })
})
