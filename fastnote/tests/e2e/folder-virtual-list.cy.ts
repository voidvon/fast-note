describe('folder note virtual list', () => {
  const viewports = [
    { label: 'mobile', width: 390, height: 844 },
    { label: 'desktop', width: 1280, height: 800 },
  ]

  viewports.forEach(({ label, width, height }) => it(`virtualizes notes on ${label}`, () => {
    const folderId = 'virtual-folder-e2e'
    const updated = '2026-08-04 01:00:00.000Z'

    cy.viewport(width, height)
    cy.visit('/home')
    cy.window().its('db').should('exist')
    cy.window().then(async (win: Window & { db: any }) => {
      const notes = Array.from({ length: 250 }, (_, index) => ({
        id: `folder-virtual-note-${index}`,
        title: `文件夹虚拟备忘录 ${index}`,
        summary: `virtual folder row ${index}`,
        content: '',
        created: updated,
        updated,
        item_type: 2,
        parent_id: folderId,
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      }))

      await win.db.notes.clear()
      await win.db.notes.bulkPut([
        {
          id: folderId,
          title: '虚拟列表文件夹',
          summary: '',
          content: '',
          created: updated,
          updated,
          item_type: 1,
          parent_id: '',
          is_deleted: 0,
          is_locked: 0,
          note_count: 250,
          version: 1,
          files: [],
        },
        ...notes,
      ])
    })

    cy.visit(`/f/${folderId}`)
    cy.get('.folder-page-content:visible .note-list--virtual.virtual-list').should('be.visible')
    cy.get('.folder-page-content:visible .note-list--virtual .note-list-item--note')
      .should('have.length.greaterThan', 0)
      .and('have.length.lessThan', 250)
    cy.contains('文件夹虚拟备忘录 0').should('be.visible')

    cy.get('.folder-page-content:visible').scrollTo('bottom', { duration: 300 })
    cy.contains('文件夹虚拟备忘录 99').should('be.visible')
  }))
})
