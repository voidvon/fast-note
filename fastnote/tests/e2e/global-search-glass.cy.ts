describe('global search glass controls', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
    cy.visit('/home', {
      onBeforeLoad(window) {
        window.localStorage.setItem('themeMode', 'light')
      },
    })
  })

  const expectGlassEffect = (selector: string, background: string) => {
    cy.get(selector).should('be.visible').then(($element) => {
      const styles = getComputedStyle($element.get(0))

      expect(styles.backgroundColor).to.equal(background)
      expect(styles.backdropFilter).to.contain('blur(')
      expect(styles.backdropFilter).to.contain('saturate(')
    })
  }

  it('keeps the field and both actions frosted in light and dark themes', () => {
    cy.get('.global-search .app-glass-circle-button').should('have.length', 2)
    expectGlassEffect('.global-search__field-shell', 'rgba(255, 255, 255, 0.01)')
    expectGlassEffect('.global-search .app-glass-circle-button', 'rgba(255, 255, 255, 0.01)')

    cy.window().then((window) => {
      window.localStorage.setItem('themeMode', 'dark')
    })
    cy.reload()

    expectGlassEffect('.global-search__field-shell', 'rgba(255, 255, 255, 0.024)')
    expectGlassEffect('.global-search .app-glass-circle-button', 'rgba(255, 255, 255, 0.024)')
  })
})
