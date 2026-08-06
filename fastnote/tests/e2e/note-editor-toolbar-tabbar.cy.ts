describe('note editor Framework7 tabbar', () => {
  const noteId = 'framework7-editor-toolbar-note'
  const secondNoteId = 'framework7-editor-toolbar-note-2'
  const folderId = 'framework7-home-folder'

  function seedNoteAndVisit(width: number, height: number) {
    cy.viewport(width, height)
    cy.visit('/home')
    cy.window().its('db').should('exist')
    cy.window().then(async (window: Window & { db: any }) => {
      await window.db.notes.clear()
      await window.db.note_files.clear()
      await window.db.notes.put({
        id: noteId,
        title: 'Framework7 编辑工具栏',
        summary: '验证底部滚动标签栏',
        content: '<p>Toolbar visual regression</p>',
        created: '2024-01-02 03:04:05.000Z',
        updated: '2024-01-02 03:04:05.000Z',
        item_type: 2,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      })
      await window.db.notes.put({
        id: secondNoteId,
        title: 'Framework7 第二条备忘录',
        summary: '验证桌面端切换后页头操作',
        content: '<p>Desktop navbar regression</p>',
        created: '2024-01-03 03:04:05.000Z',
        updated: '2024-01-03 03:04:05.000Z',
        item_type: 2,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      })
      await window.db.notes.put({
        id: folderId,
        title: 'Framework7 文件夹',
        summary: '',
        content: '',
        created: '2024-01-04 03:04:05.000Z',
        updated: '2024-01-04 03:04:05.000Z',
        item_type: 1,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 1,
        version: 1,
        files: [],
      })
      await window.db.notes.put({
        id: 'framework7-child-folder',
        title: '子文件夹',
        summary: '',
        content: '',
        created: '2024-01-05 03:04:05.000Z',
        updated: '2024-01-05 03:04:05.000Z',
        item_type: 1,
        parent_id: folderId,
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      })
    })
    cy.visit(`/n/${noteId}`)
    cy.get('#app-loading').should('not.exist')
  }

  function assertNativeToolbar() {
    cy.get('.note-editor-toolbar.toolbar.tabbar-scrollable.toolbar-bottom')
      .should('be.visible')
      .and('not.have.class', 'app-pane-footer')
      .and('not.have.class', 'tabbar')
      .and('not.have.class', 'tabbar-icons')
      .then(($toolbar) => {
        expect(getComputedStyle($toolbar.get(0)).height).to.equal('64px')
      })

    cy.get('.note-editor-toolbar > .toolbar-inner > .toolbar-pane').then(($pane) => {
      const style = getComputedStyle($pane.get(0))
      expect($pane.get(0).getBoundingClientRect().height).to.equal(48)
      expect(style.borderRadius).to.equal('32px')
      expect(style.backdropFilter).not.to.equal('none')
      expect(style.backgroundColor).not.to.equal('rgba(0, 0, 0, 0)')
      expect(style.boxShadow).not.to.equal('none')
      expect(['auto', 'scroll']).to.include(style.overflowX)
    })

    cy.get('.note-editor-toolbar__action')
      .should('have.length', 5)
      .each(($action) => {
        expect($action).to.have.class('icon-only')
        const { width, height } = $action.get(0).getBoundingClientRect()
        expect(Math.abs(width - height)).to.be.lessThan(1)
      })

    cy.get('.note-editor-toolbar .link')
      .should('have.length', 5)

    cy.get('.note-editor-toolbar .tab-link-active')
      .should('not.exist')

    cy.get('.note-editor-toolbar .tab-link-highlight')
      .should('not.exist')
  }

  it('renders the native iOS toolbar with a 48px visible pane on mobile', () => {
    seedNoteAndVisit(390, 844)
    assertNativeToolbar()
  })

  it('uses a popover instead of a sheet for table actions on mobile', () => {
    seedNoteAndVisit(390, 844)
    cy.get('[data-testid="note-editor-toolbar-table"]').click()

    cy.get('.table-format-popover.popover.modal-in').should('exist')
    cy.get('.table-format-popover').should('not.have.class', 'sheet-modal')
    cy.get('.sheet-modal.table-format-popover').should('not.exist')
  })

  it('anchors the table actions beside the toolbar button on desktop', () => {
    seedNoteAndVisit(1280, 800)
    cy.get('#home-note-detail-pane [data-testid="note-editor-toolbar-table"]').click()

    cy.get('.table-format-popover.popover.modal-in')
      .should('be.visible')
      .then(($popover) => {
        const popoverRect = $popover[0].getBoundingClientRect()

        expect($popover[0].offsetWidth).to.be.greaterThan(0)
        expect($popover[0].offsetWidth).to.be.lessThan(240)

        const title = $popover[0].querySelector<HTMLElement>('.item-title')
        expect(title).not.to.equal(null)
        expect(getComputedStyle(title!).fontSize).to.equal('15px')
        expect(getComputedStyle(title!).fontWeight).to.equal('500')

        cy.get('#home-note-detail-pane [data-testid="note-editor-toolbar-table"]').then(($trigger) => {
          const triggerRect = $trigger[0].getBoundingClientRect()

          expect(popoverRect.left).to.be.greaterThan(triggerRect.left - popoverRect.width - 40)
          expect(popoverRect.left).to.be.lessThan(triggerRect.right + 40)
          expect(popoverRect.top).to.be.greaterThan(triggerRect.top - popoverRect.height - 40)
          expect(popoverRect.top).to.be.lessThan(triggerRect.bottom + 40)
        })
      })
    cy.contains('.table-format-popover .item-content', '插入表格').should('be.visible')
    cy.contains('.table-format-popover .item-content', '插入列').should('be.visible')
    cy.contains('.table-format-popover .item-content', '插入行').should('be.visible')

    cy.get('body').type('{esc}')
    cy.get('.table-format-popover').should('not.be.visible')
    cy.get('#home-note-detail-pane .app-page-embedded.note-detail')
      .should(($detail) => {
        expect($detail.get(0).scrollTop).to.equal(0)
      })
  })

  it('uses true black page and dropdown surfaces in dark mode', () => {
    seedNoteAndVisit(1280, 800)
    cy.document().then((document) => {
      document.documentElement.classList.add('app-theme-dark', 'dark')
    })

    cy.get('#home-note-detail-pane .note-detail__content').should(($detail) => {
      expect(getComputedStyle($detail[0]).backgroundColor).to.equal('rgb(0, 0, 0)')
    })
    cy.get('.home-navigation-content .list.accordion-list.list-strong.inset > ul').should(($list) => {
      expect(getComputedStyle($list[0]).backgroundColor).to.equal('rgb(28, 28, 29)')
      expect(getComputedStyle($list[0]).borderRadius).not.to.equal('0px')
    })

    cy.get('#home-note-detail-pane [data-testid="note-editor-toolbar-table"]').click()
    cy.get('.table-format-popover.popover.modal-in .popover-inner').should(($inner) => {
      expect(getComputedStyle($inner[0]).backgroundColor).to.equal('rgb(0, 0, 0)')
    })
  })

  it('does not mount closed sheets inside pull-to-refresh content', () => {
    seedNoteAndVisit(1280, 800)

    cy.get('.home-navigation-content .sheet-modal').should('not.exist')
    cy.get('.home-navigation-content').then(($content) => {
      for (const child of $content[0].children) {
        (child as HTMLElement).style.transform = 'translate3d(0, 44px, 0)'
      }
    })
    cy.get('.home-navigation-content .sheet-modal').should('not.exist')
  })

  it('expands homepage folders only from the arrow control', () => {
    seedNoteAndVisit(1280, 800)

    cy.get('.home-navigation-content .message-list-item.no-children:visible')
      .first()
      .as('emptyFolder')
      .find('.folder-accordion-toggle')
      .should('exist')
      .and('have.attr', 'aria-label', '打开文件夹')
      .click()
    cy.get('@emptyFolder')
      .should('have.class', 'active')
      .and('not.have.class', 'accordion-item-opened')

    cy.get(`.home-navigation-content .message-list-item[data-id="${folderId}"]`)
      .filter(':visible')
      .first()
      .as('folder')
      .should('not.have.class', 'accordion-item-opened')
      .find('.folder-item-title')
      .first()
      .click()
    cy.get('@folder').should('not.have.class', 'accordion-item-opened')

    cy.get('@folder').find('.folder-accordion-toggle').first().click()
    cy.get('@folder').should('have.class', 'accordion-item-opened')

    cy.get('@folder')
      .find(`[data-id="framework7-child-folder"] .folder-item-title`)
      .first()
      .click()
    cy.url().should('include', `/f/${folderId}/framework7-child-folder`)
    cy.get('#home-note-list-pane > .app-page-embedded .folder-navbar .title-large')
      .should('contain.text', '子文件夹')
    cy.get('@folder')
      .find(`[data-id="framework7-child-folder"]`)
      .first()
      .should('have.class', 'active')
    cy.get('@folder').should('have.class', 'accordion-item-opened')

    cy.get('@emptyFolder').find('.folder-item-title').first().click()
    cy.get('@folder')
      .should('have.class', 'accordion-item-opened')
      .find('.folder-accordion-toggle')
      .first()
      .should('have.attr', 'aria-label', '收起文件夹')
  })

  it('keeps the native iOS toolbar with a 48px visible pane on desktop', () => {
    seedNoteAndVisit(1280, 800)
    cy.get('#home-note-detail-pane .app-pane-footer').should('not.exist')
    cy.get('#home-note-detail-pane').within(() => {
      cy.get('[data-testid="note-more-trigger"]')
        .should('be.visible')
        .find('svg, i')
        .should('be.visible')
      assertNativeToolbar()
    })
  })

  it('keeps the more action visible after switching notes on desktop', () => {
    seedNoteAndVisit(1280, 800)
    cy.get(`#home-note-list-pane [data-id="${secondNoteId}"]`).click()
    cy.url().should('include', `/n/${secondNoteId}`)
    cy.get('#home-note-detail-pane [data-testid="note-more-trigger"]')
      .should('be.visible')
      .click()
    cy.get('.note-more-modal.popover.modal-in')
      .should('be.visible')
      .then(($popover) => {
        const popoverRect = $popover[0].getBoundingClientRect()

        cy.get('#home-note-detail-pane [data-testid="note-more-trigger"]').then(($trigger) => {
          const triggerRect = $trigger[0].getBoundingClientRect()

          expect(popoverRect.left).to.be.greaterThan(triggerRect.left - popoverRect.width - 40)
          expect(popoverRect.left).to.be.lessThan(triggerRect.right + 40)
          expect(popoverRect.top).to.be.greaterThan(triggerRect.top - popoverRect.height - 40)
          expect(popoverRect.top).to.be.lessThan(triggerRect.bottom + 40)
        })
      })

    cy.get('body').type('{esc}')
    cy.get('.note-more-modal.popover').should('not.be.visible')
    cy.get('#home-note-detail-pane [data-testid="note-more-trigger"]').click()
    cy.get('.note-more-modal.popover.modal-in').should('be.visible')
  })

  it('restores the more action when resizing a note route into desktop mode', () => {
    seedNoteAndVisit(390, 844)
    cy.viewport(1280, 800)
    cy.get('#home-note-detail-pane [data-testid="note-more-trigger"]')
      .should('be.visible')
  })
})
