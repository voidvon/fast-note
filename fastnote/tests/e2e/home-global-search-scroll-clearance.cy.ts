describe('home global search scroll clearance', () => {
  it('reserves the mobile search dock height in the Framework7 scroll container', () => {
    cy.viewport(390, 844)
    cy.visit('/home')

    cy.get('.home-navigation-content').then(($content) => {
      const content = $content.get(0)

      expect(getComputedStyle(content).paddingBottom).to.equal('68px')
    })
  })

  it('keeps the Framework7 content background when global search gains focus', () => {
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

    cy.get('.global-search__input input').click()
    cy.get('.global-search__panel-surface--active').should('exist')
    cy.get('.home-navigation-content').should(($content) => {
      const backgroundAfterFocus = getComputedStyle($content.get(0))
        .getPropertyValue('--background')
        .trim()

      expect(backgroundAfterFocus).to.equal(backgroundBeforeFocus)
    })
  })

  it('uses a full-screen Framework7 scroll viewport behind both glass toolbars', () => {
    cy.viewport(390, 844)
    cy.visit('/home')

    cy.get('.global-search__input input').click()
    cy.get('.global-search__panel-surface--active').should('exist')

    cy.get('.global-search__panel').then(($panel) => {
      const panelRect = $panel.get(0).getBoundingClientRect()

      cy.get('.global-search__panel-content').then(($content) => {
        const content = $content.get(0)
        const contentRect = content.getBoundingClientRect()

        expect(contentRect.top).to.equal(panelRect.top)
        expect(contentRect.bottom).to.equal(panelRect.bottom)
        expect(Number.parseFloat(getComputedStyle(content).paddingTop)).to.be.greaterThan(0)
        expect(Number.parseFloat(getComputedStyle(content).paddingBottom)).to.be.greaterThan(44)
      })

      cy.get('.global-search__panel-header').then(($header) => {
        const headerRect = $header.get(0).getBoundingClientRect()

        expect(headerRect.top).to.equal(panelRect.top)
        expect(headerRect.bottom).to.be.greaterThan(panelRect.top)
      })

      cy.get('.global-search__dock').then(($dock) => {
        const dockRect = $dock.get(0).getBoundingClientRect()

        expect(dockRect.top).to.be.lessThan(panelRect.bottom)
        expect(dockRect.bottom).to.be.greaterThan(panelRect.top)
      })
    })
  })
})
