describe('Framework7 migration preview', () => {
  it('keeps the existing home route and opens the virtual-list preview', () => {
    cy.visit('/home')
    cy.get('#framework7-root').should('be.visible')
    cy.get('body').should('not.contain.text', '[object Promise]')
    cy.get('.home-navigation-content .list').should('be.visible')
    cy.get('.home-navigation-content .list.accordion-list > ul > li').should('have.length.greaterThan', 0)
    cy.get('.home-navigation-content .list.accordion-list > ul > li')
      .first()
      .find('> .item-content, > a > .item-content')
      .should('have.length', 1)
    cy.get('.home-navigation-content .app-list-item:is(div, button)').should('not.exist')
    cy.window().its('db').should('exist')
    cy.window().then(async (win: Window & { db: any }) => {
      const updated = '2026-08-01 21:00:00.000Z'
      const records = Array.from({ length: 250 }, (_, index) => ({
        id: `framework7-e2e-${index}`,
        title: `虚拟列表备忘录 ${index}`,
        summary: `Framework7 virtual row ${index}`,
        content: '',
        created: updated,
        updated,
        item_type: 2,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      }))

      await win.db.notes.clear()
      await win.db.notes.bulkPut(records)
    })

    cy.visit('/framework7-preview')
    cy.get('#framework7-root').should('exist')
    cy.get('[data-testid="framework7-preview"]').should('be.visible')
    cy.contains('250 项').should('be.visible')
    cy.get('.f7-preview__row').should('have.length.greaterThan', 0)
    cy.get('.f7-preview__row').should('have.length.lessThan', 250)
    cy.contains('虚拟列表备忘录 0').should('be.visible')
    cy.get('input[aria-label="搜索备忘录"]')
      .should('be.visible')
      .type('不存在的备忘录', { scrollBehavior: 'center' })
    cy.contains('没有匹配的备忘录').should('be.visible')
  })
})
