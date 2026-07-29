import { DESKTOP_PANE_LAYOUT_STORAGE_KEY } from '../../src/features/desktop-pane-layout'

describe('desktop pane resize', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
  })

  it('renders, resizes and restores the desktop three-pane layout', () => {
    cy.viewport(1440, 900)
    cy.visit('/home')

    cy.get('[role="separator"]').should('have.length', 2)
    cy.get('#home-navigation-pane').then(($navigation) => {
      const initialWidth = $navigation[0].getBoundingClientRect().width

      cy.get('[role="separator"]').first().then(($splitter) => {
        const startX = $splitter[0].getBoundingClientRect().left
        cy.wrap($splitter)
          .trigger('pointerdown', { button: 0, clientX: startX, pointerId: 1 })
          .trigger('pointermove', { clientX: startX + 40, pointerId: 1 })
          .trigger('pointerup', { clientX: startX + 40, pointerId: 1 })
      })
      cy.get('#home-navigation-pane').should(($resizedNavigation) => {
        expect($resizedNavigation[0].getBoundingClientRect().width).to.be.closeTo(initialWidth + 40, 0.5)
      })
    })

    cy.window().should((win) => {
      expect(win.localStorage.getItem(DESKTOP_PANE_LAYOUT_STORAGE_KEY)).not.to.equal(null)
    })

    cy.reload()
    cy.get('#home-navigation-pane').should(($navigation) => {
      expect($navigation[0].getBoundingClientRect().width).to.be.closeTo(401, 0.5)
    })
    cy.get('#home-note-detail-pane').should(($detail) => {
      expect($detail[0].getBoundingClientRect().right).to.be.closeTo(1440, 0.5)
    })
  })

  it('keeps the mobile viewport in single-pane mode', () => {
    cy.viewport(390, 844)
    cy.visit('/home')

    cy.get('.home-navigation').should('be.visible')
    cy.get('[role="separator"]').should('not.exist')
    cy.get('#home-note-list-pane').should('not.exist')
    cy.get('#home-note-detail-pane').should('not.exist')
  })
})
