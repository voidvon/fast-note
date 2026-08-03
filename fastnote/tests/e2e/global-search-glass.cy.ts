describe('global search glass controls', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
    cy.visit('/home', {
      onBeforeLoad(window) {
        window.localStorage.setItem('themeMode', 'light')
      },
    })
  })

  const expectGlassEffect = (selector: string) => {
    cy.get(selector).should('be.visible').then(($element) => {
      const styles = getComputedStyle($element.get(0))

      expect(styles.backgroundColor).not.to.equal('rgba(0, 0, 0, 0)')
      expect(styles.backdropFilter).to.contain('blur(')
      expect(styles.backdropFilter).to.contain('saturate(')
    })
  }

  it('uses two action panes and one unnested 48px search surface', () => {
    cy.get('.global-search__toolbar.toolbar.toolbar-bottom').should('be.visible')
    cy.get('.global-search__toolbar > .toolbar-inner > .toolbar-pane')
      .should('have.length', 2)
      .each(($pane) => {
        expect($pane.get(0).getBoundingClientRect().height).to.equal(48)
      })
    cy.get('.global-search__action-pane--leading').then(($leading) => {
      const leadingRect = $leading.get(0).getBoundingClientRect()
      const toolbarRect = $leading.get(0).closest('.toolbar')!.getBoundingClientRect()
      const pageRect = $leading.get(0).closest('.page')!.getBoundingClientRect()
      expect(leadingRect.left - toolbarRect.left).to.equal(16)
      expect(pageRect.bottom - leadingRect.bottom).to.equal(16)
    })
    cy.get('.global-search__action-pane--leading').then(($leading) => {
      cy.get('.global-search__field-pane').then(($field) => {
        const leadingRect = $leading.get(0).getBoundingClientRect()
        const fieldRect = $field.get(0).getBoundingClientRect()
        expect(fieldRect.left - leadingRect.right).to.equal(16)
      })
    })
    cy.get('.global-search__field-pane')
      .should('not.have.class', 'toolbar-pane')
      .then(($field) => {
        expect($field.get(0).getBoundingClientRect().height).to.equal(48)
      })
    cy.get('.global-search .app-glass-circle-button').should('have.length', 2).each(($button) => {
      const { width, height } = $button.get(0).getBoundingClientRect()
      expect(width).to.equal(48)
      expect(height).to.equal(48)
    })
    cy.get('.global-search__field-shell').should('not.exist')
    expectGlassEffect('.global-search__input.searchbar input')

    cy.window().then((window) => {
      window.localStorage.setItem('themeMode', 'dark')
    })
    cy.reload()

    cy.get('.global-search__field-shell').should('not.exist')
    expectGlassEffect('.global-search__input.searchbar input')
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
