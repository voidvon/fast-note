describe('note move sheet scrolling', () => {
  function openMoveSheet(presentation: 'popover' | 'sheet') {
    cy.get('[data-id="move-folder-0"]').first().trigger('contextmenu', { force: true })
    if (presentation === 'popover') {
      cy.get('.fastnote-note-actions-menu--popover.popover.modal-in')
        .should('be.visible')
        .and(($popover) => {
          const rect = $popover.get(0).getBoundingClientRect()
          expect(rect.left).to.be.greaterThan(0)
          expect(rect.top).to.be.greaterThan(0)
        })
        .contains('.item-title', '移动')
        .click()
      cy.get('.fastnote-note-actions-menu--popover.popover.modal-in').should('not.exist')
    }
    else {
      cy.get('#long-press-menu.actions-modal.modal-in')
        .should('be.visible')
        .contains('.actions-button', '移动')
        .click()
      cy.get('#long-press-menu.actions-modal.modal-in').should('not.exist')
    }
    cy.get('.note-move-modal.modal-in').should('have.length', 1).and('be.visible')
    cy.get('.note-move-content').should(($content) => {
      const content = $content.get(0)
      const autWindow = content.ownerDocument.defaultView!
      expect(content.classList.contains('page-content')).to.equal(true)
      expect(content.parentElement?.classList.contains('sheet-modal-inner')).to.equal(true)
      expect(content.getBoundingClientRect().bottom).to.be.closeTo(autWindow.innerHeight, 0.01)
    })
  }

  function assertTouchScrolls() {
    cy.get('.note-move-content').then(async ($content) => {
      const content = $content.get(0)
      const rect = content.getBoundingClientRect()
      const autWindow = content.ownerDocument.defaultView!
      const autFrame = Array.from(autWindow.parent.document.querySelectorAll<HTMLIFrameElement>('iframe'))
        .find(frame => frame.contentWindow === autWindow)
        || autWindow.parent.document.querySelector<HTMLIFrameElement>('iframe.aut-iframe')
      const frameRect = autFrame?.getBoundingClientRect()
      const frameScaleX = frameRect ? frameRect.width / autWindow.innerWidth : 1
      const frameScaleY = frameRect ? frameRect.height / autWindow.innerHeight : 1
      const x = (frameRect?.left || 0) + (rect.left + rect.width / 2) * frameScaleX
      const startY = (frameRect?.top || 0) + (rect.top + rect.height / 2) * frameScaleY
      content.scrollTop = 0

      await Cypress.automation('remote:debugger:protocol', {
        command: 'Input.synthesizeScrollGesture',
        params: {
          x,
          y: startY,
          yDistance: -240,
          speed: 800,
          gestureSourceType: 'touch',
        },
      })
      await new Promise(resolve => autWindow.setTimeout(resolve, 100))
    })
    cy.get('.note-move-content').should(($content) => {
      expect($content.get(0).scrollTop).to.be.greaterThan(0)
    })
  }

  function assertWheelScrolls() {
    cy.get('.note-move-content').then(async ($content) => {
      const content = $content.get(0)
      expect(content.scrollHeight).to.be.greaterThan(content.clientHeight)
      const autWindow = content.ownerDocument.defaultView!
      const rect = content.getBoundingClientRect()
      const frameRect = autWindow.frameElement?.getBoundingClientRect()
      const frameScaleX = frameRect ? frameRect.width / autWindow.innerWidth : 1
      const frameScaleY = frameRect ? frameRect.height / autWindow.innerHeight : 1
      const wheelX = (frameRect?.left || 0) + (rect.left + rect.width / 2) * frameScaleX
      const wheelY = (frameRect?.top || 0) + (rect.top + rect.height / 2) * frameScaleY
      content.scrollTop = 0

      await Cypress.automation('remote:debugger:protocol', {
        command: 'Input.dispatchMouseEvent',
        params: {
          type: 'mouseWheel',
          x: wheelX,
          y: wheelY,
          deltaX: 0,
          deltaY: 320,
        },
      })
      await new Promise(resolve => autWindow.setTimeout(resolve, 100))
    })
    cy.get('.note-move-content').should(($content) => {
      expect($content.get(0).scrollTop).to.be.greaterThan(0)
    })
  }

  function seedFolders() {
    const updated = '2026-08-04 12:00:00.000Z'

    cy.visit('/home')
    cy.window().its('db').should('exist')
    cy.window().then(async (win: Window & { db: any }) => {
      const folders = Array.from({ length: 60 }, (_, index) => ({
        id: `move-folder-${index}`,
        title: `移动测试文件夹 ${index}`,
        summary: '',
        content: '',
        created: updated,
        updated,
        item_type: 1,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      }))

      await win.db.notes.clear()
      await win.db.notes.bulkPut(folders)
    })
  }

  it('supports touch scrolling on mobile after reopening and refreshing', () => {
    cy.viewport(390, 844)
    seedFolders()

    cy.visit('/home')
    openMoveSheet('sheet')
    assertTouchScrolls()

    cy.get('.note-move-close').click()
    cy.get('.note-move-modal').should('not.exist')
    openMoveSheet('sheet')
    assertTouchScrolls()

    cy.reload()
    openMoveSheet('sheet')
    assertTouchScrolls()
  })

  it('keeps wheel scrolling available on desktop', () => {
    cy.viewport(1280, 800)
    seedFolders()

    cy.visit('/home')
    openMoveSheet('popover')
    assertWheelScrolls()
  })
})
