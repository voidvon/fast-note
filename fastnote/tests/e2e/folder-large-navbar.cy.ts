describe('folder large navbar', () => {
  it('re-centers an asynchronously loaded title when the navbar collapses', () => {
    cy.viewport(390, 844)
    cy.visit('/f/allnotes')
    cy.get('#app-loading').should('not.exist')
    cy.get('.page-current .folder-navbar.navbar-large .title')
      .should('contain.text', '全部备忘录')
    cy.get('.page-current .folder-page-content').then(($content) => {
      const spacer = document.createElement('div')
      spacer.style.height = '1000px'
      $content.get(0).append(spacer)
    })
    cy.get('.page-current .folder-page-content').scrollTo(0, 100, { duration: 0 })
    cy.get('.page-current .folder-navbar.navbar-large-collapsed').within(() => {
      cy.get('.title').then(($title) => {
        const navbarRect = $title.get(0).closest('.navbar')!.getBoundingClientRect()
        const titleRect = $title.get(0).getBoundingClientRect()
        const navbarCenter = navbarRect.left + navbarRect.width / 2
        const titleCenter = titleRect.left + titleRect.width / 2
        expect(titleCenter).to.be.closeTo(navbarCenter, 1)
      })
    })
  })
})
