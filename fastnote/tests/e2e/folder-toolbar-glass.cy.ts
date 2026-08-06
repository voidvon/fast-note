describe('folder toolbar glass surface', () => {
  function assertActionGlass($toolbar: JQuery<HTMLElement>) {
    const actionStyle = getComputedStyle($toolbar.find('.left')[0])

    expect(actionStyle.backgroundColor).not.to.equal('rgba(0, 0, 0, 0)')
    expect(actionStyle.backdropFilter).to.contain('blur')
  }

  it('uses a translucent blurred surface in desktop and mobile folder toolbars', () => {
    cy.viewport(1280, 800)
    cy.visit('/home')
    cy.get('#app-loading').should('not.exist')
    cy.get('.home-list .folder-create-toolbar').should('be.visible').then(($toolbar) => {
      const toolbarStyle = getComputedStyle($toolbar[0])
      expect(toolbarStyle.position).to.equal('absolute')
      expect(toolbarStyle.backgroundColor).to.equal('rgba(0, 0, 0, 0)')
      assertActionGlass($toolbar)
    })

    cy.viewport(390, 844)
    cy.visit('/f/allnotes')
    cy.get('#app-loading').should('not.exist')
    cy.get('.page-current .folder-create-toolbar').should('be.visible').then($toolbar => assertActionGlass($toolbar))
  })
})
