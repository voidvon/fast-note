describe('home large navbar', () => {
  it('collapses the official large title when its pane scrolls', () => {
    cy.viewport(1280, 800)
    cy.visit('/home')
    cy.get('#app-loading').should('not.exist')
    cy.get('.home-navbar.navbar-large').should('not.have.class', 'navbar-large-collapsed')
    cy.get('.home-navigation-content').then(($content) => {
      const spacer = document.createElement('div')
      spacer.style.height = '1000px'
      $content.get(0).append(spacer)
    })
    cy.get('.home-navigation-content').scrollTo(0, 80, { duration: 0 })
    cy.get('.home-navbar.navbar-large').should('have.class', 'navbar-large-collapsed')
    cy.get('.home-navigation-content').scrollTo(0, 0, { duration: 0 })
    cy.get('.home-navbar.navbar-large').should('not.have.class', 'navbar-large-collapsed')
  })
})
