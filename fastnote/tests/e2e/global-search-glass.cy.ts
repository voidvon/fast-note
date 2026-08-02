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
    cy.get('.global-search__field-shell').should('not.exist')
    expectGlassEffect('.global-search__input.searchbar input', 'rgba(255, 255, 255, 0.01)')
    expectGlassEffect('.global-search .app-glass-circle-button', 'rgba(255, 255, 255, 0.01)')

    cy.window().then((window) => {
      window.localStorage.setItem('themeMode', 'dark')
    })
    cy.reload()

    cy.get('.global-search__field-shell').should('not.exist')
    expectGlassEffect('.global-search__input.searchbar input', 'rgba(255, 255, 255, 0.024)')
    expectGlassEffect('.global-search .app-glass-circle-button', 'rgba(255, 255, 255, 0.024)')
  })

  it('keeps the Framework7 search input inside the visible hit area', () => {
    cy.get('.page-current:not([aria-hidden="true"]) .global-search__input input')
      .should('have.attr', 'placeholder', '搜索')
      .then(($input) => {
        const input = $input.get(0)
        const rect = input.getBoundingClientRect()
        const hitTarget = input.ownerDocument.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        )
        expect(hitTarget, JSON.stringify({
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        })).to.equal(input)
      })
      .click()
      .type('测试')
      .should('have.value', '测试')
  })
})
