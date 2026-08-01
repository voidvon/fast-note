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
})
