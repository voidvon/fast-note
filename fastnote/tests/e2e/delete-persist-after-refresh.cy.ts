describe('T-FN-003 / TC-FN-003 delete persists after refresh', () => {
  const noteId = 'e2e-delete-refresh-note'
  const noteTitle = 'E2E 删除后刷新仍在回收站'

  function seedSingleNote() {
    cy.window().then(async (win: Window & { db: any }) => {
      const now = '2026-03-06 15:30:00.000Z'

      await win.db.notes.clear()
      await win.db.note_files.clear()

      await win.db.notes.put({
        id: noteId,
        title: noteTitle,
        summary: '验证删除后刷新仍持久化',
        content: '<p>验证删除持久化</p>',
        created: now,
        updated: now,
        item_type: 2,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      })
    })
  }

  function expectDeletedInIndexedDb() {
    cy.window().then((win: Window & { db: any }) => {
      cy.wrap(win.db.notes.get(noteId)).its('is_deleted').should('eq', 1)
    })
  }

  beforeEach(() => {
    cy.viewport(390, 844)
    cy.visit('/home')
    cy.window().its('db').should('exist')
    seedSingleNote()
    cy.reload()
  })

  it('keeps the note deleted after page refresh', () => {
    cy.contains('全部备忘录').click()
    cy.url().should('include', '/f/allnotes')

    cy.contains(noteTitle).click()
    cy.url().should('include', `/n/${noteId}`)

    cy.get('ion-header ion-buttons[slot="end"] ion-button').click()
    cy.contains('删除').should('be.visible').click()

    cy.url().should('include', '/f/allnotes')
    expectDeletedInIndexedDb()

    cy.contains('最近删除').should('be.visible').click()
    cy.url().should('include', '/deleted')
    cy.contains(noteTitle).should('be.visible')

    cy.reload()
    expectDeletedInIndexedDb()

    cy.contains(noteTitle).should('be.visible')
  })
})
