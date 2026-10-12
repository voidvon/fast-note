describe('locked note homepage restore', () => {
  const noteId = 'e2e-locked-home-note'
  const content = '<p>密码解锁后必须保留的正文</p>'

  function expectStoredContent(expected: string, attempts = 30): Cypress.Chainable {
    return cy.window().then((win: Window & { db: any }) => win.db.notes.get(noteId)).then((note) => {
      if (note.content === expected || attempts === 0) {
        expect(note.content).to.equal(expected)
        return
      }
      return cy.wait(100).then(() => expectStoredContent(expected, attempts - 1))
    })
  }

  beforeEach(() => {
    cy.viewport(1280, 800)
    cy.visit('/home')
    cy.window().its('db').should('exist')
    cy.window().then(async (win: Window & { db: any }) => {
      const salt = 'e2e-note-lock-salt'
      const digest = await win.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`${salt}:123456`),
      )
      const hash = Array.from(new Uint8Array(digest))
        .map(value => value.toString(16).padStart(2, '0'))
        .join('')
      await win.db.notes.clear()
      await win.db.note_unlock_sessions.clear()
      await win.db.security_settings.put({
        scope_key: win.db.name,
        pin_secret_salt: salt,
        pin_secret_hash: hash,
        pin_version: 1,
        updated: '2024-01-01 10:00:00',
      })
      await win.db.notes.put({
        id: noteId,
        title: '密码解锁后必须保留的正文',
        content,
        created: '2024-01-01 10:00:00',
        updated: '2024-01-01 10:00:00',
        item_type: 2,
        parent_id: '',
        is_deleted: 0,
        is_locked: 1,
        note_count: 0,
        files: [],
      })
    })
    cy.reload()
    cy.get('[data-testid="note-unlock-panel"]').should('be.visible')
    cy.get('#home-note-detail-pane .tiptap').should('not.exist')
    cy.get('#note-unlock-panel-pin').type('123456')
    cy.contains('[data-testid="note-unlock-panel"] button', '解锁').click()
  })

  it('keeps the restored content after unlock, blur, pagehide and refresh', () => {
    cy.get('#home-note-detail-pane .tiptap')
      .should('contain.text', '密码解锁后必须保留的正文')
      .click()
      .blur()
    cy.wait(900) // Exercise the 800ms blur-save timer before the leave flush.
    cy.window().then((win: Window & { db: any }) => {
      win.dispatchEvent(new Event('pagehide'))
      cy.wrap(win.db.notes.get(noteId)).its('content').should('eq', content)
    })
    cy.reload()
    cy.get('#home-note-detail-pane .tiptap')
      .should('contain.text', '密码解锁后必须保留的正文')
  })

  it('allows deliberately clearing an unlocked note and persists the edit', () => {
    cy.get('#home-note-detail-pane .tiptap')
      .should('contain.text', '密码解锁后必须保留的正文')
      .click()
      .type('{selectall}{backspace}')
      .blur()
    cy.wait(900)
    cy.window().then((win: Window & { db: any }) => {
      win.dispatchEvent(new Event('pagehide'))
    })
    expectStoredContent('<p></p>')
    cy.reload()
    cy.get('#home-note-detail-pane .tiptap').should('have.text', '')
  })

  it('saves a return to the original content after an intermediate edit was persisted', () => {
    cy.get('#home-note-detail-pane .tiptap')
      .should('contain.text', '密码解锁后必须保留的正文')
      .click()
      .type('{selectall}{backspace}')
      .blur()
    expectStoredContent('<p></p>')

    cy.get('#home-note-detail-pane .tiptap')
      .click()
      .type('密码解锁后必须保留的正文')
      .blur()
    expectStoredContent(content)
    cy.reload()
    cy.get('#home-note-detail-pane .tiptap')
      .should('contain.text', '密码解锁后必须保留的正文')
  })
})
