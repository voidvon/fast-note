describe('mobile Ionic page transitions', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
  })

  function assertStandardPageStructure() {
    cy.get('ion-router-outlet > .ion-page:not(.ion-page-hidden)').should('have.length', 1).within(() => {
      cy.root().children('ion-header').should('have.length', 1)
      cy.root().children('ion-content').should('have.length', 1)
    })
  }

  it('keeps private and public home content in the Ionic transition surface', () => {
    cy.visit('/home')
    cy.get('#app-loading').should('not.exist')
    assertStandardPageStructure()

    cy.visit('/voidvon')
    cy.get('#app-loading').should('not.exist')
    assertStandardPageStructure()

    cy.get('ion-router-outlet > .ion-page:not(.ion-page-hidden)').children('ion-content').then(($content) => {
      const leavingContent = $content[0]

      cy.window().then(async (win) => {
        await (win as any).__VUE_APP__.config.globalProperties.$router.push('/voidvon/f/allnotes')

        const deadline = win.performance.now() + 1000
        let hasStandardContentAnimation = false

        while (!hasStandardContentAnimation && win.performance.now() < deadline) {
          hasStandardContentAnimation = win.document.getAnimations().some((animation) => {
            const effect = animation.effect as KeyframeEffect | null
            return effect?.target === leavingContent && effect.getTiming().duration === 540
          })

          if (!hasStandardContentAnimation) {
            await new Promise(resolve => win.setTimeout(resolve, 16))
          }
        }

        expect(hasStandardContentAnimation).to.equal(true)
      })
    })
  })
})
