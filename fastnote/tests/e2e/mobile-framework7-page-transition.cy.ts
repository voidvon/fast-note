describe('mobile Framework7 pages', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
  })

  function assertStandardPageStructure() {
    cy.get('.page:visible').should('have.length.at.least', 1).first().within(() => {
      cy.root().children('.app-navbar').should('have.length', 1)
      cy.root().children('.page-content').should('have.length', 1)
    })
    cy.document().then((document) => {
      const legacyElements = [...document.querySelectorAll('*')]
        .filter(element => element.tagName.startsWith('ION-'))
      expect(legacyElements).to.have.length(0)
    })
  }

  it('uses the standard Framework7 prompt dialog to create folders', () => {
    cy.visit('/home')
    cy.get('#app-loading').should('not.exist')
    cy.get('#add-folder').click()

    cy.get('.dialog.modal-in')
      .should('be.visible')
      .within(() => {
        cy.get('.dialog-input-field .dialog-input')
          .should('be.visible')
          .and('be.focused')
        cy.contains('.dialog-button', '取消').click()
      })

    cy.get('.dialog.modal-in').should('not.exist')
    cy.get('.login-screen.modal-in').should('not.exist')
  })

  it('keeps mobile folder creation buttons 48px square with white icons', () => {
    const folderId = 'framework7-mobile-toolbar-folder'

    cy.visit('/home')
    cy.get('#app-loading').should('not.exist')
    cy.window().then(async (window: Window & { db: any }) => {
      await window.db.notes.put({
        id: folderId,
        title: '移动端工具栏测试',
        summary: '',
        content: '',
        created: '2026-08-03 12:00:00.000Z',
        updated: '2026-08-03 12:00:00.000Z',
        item_type: 1,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      })
      const view = window.document.querySelector<HTMLElement>('.view-main')?.f7View
      view?.router.navigate(`/f/${folderId}`, { animate: false })
    })

    cy.get('.page-current .folder-create-button, .page-current .note-create-button')
      .should('have.length', 2)
      .and('have.class', 'text-color-white')
      .each(($button) => {
        const { width, height } = $button.get(0).getBoundingClientRect()
        expect(width).to.equal(48)
        expect(height).to.equal(48)
        expect(getComputedStyle($button.get(0)).color).to.equal('rgb(255, 255, 255)')
      })
  })

  it('opens note actions as a swipe-to-close Framework7 sheet', () => {
    const noteId = 'framework7-sheet-note'
    const now = '2026-08-02 12:00:00.000Z'

    cy.visit('/home')
    cy.window().its('db').should('exist')
    cy.window().then(async (window: Window & { db: any }) => {
      await window.db.notes.put({
        id: noteId,
        title: 'Framework7 Sheet 测试',
        summary: '验证底部操作面板',
        content: '<p>Sheet content</p>',
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

    cy.visit(`/n/${noteId}`)
    cy.get('[data-testid="note-more-trigger"]').should('be.visible').click()
    cy.get('.note-more-modal.sheet-modal.modal-in')
      .should('be.visible')
      .within(() => {
        cy.get('.toolbar').should('be.visible')
        cy.get('.page-content').should('be.visible')
        cy.get('.list.list-strong.inset').should('have.length', 1)
        cy.get('[data-testid="note-more-lock-action"]').should('be.visible')
        cy.get('[data-testid="note-more-public-action"]').should('be.visible')
        cy.get('[data-testid="note-more-delete-action"]').should('be.visible')
        cy.get('.app-grid, .app-row, .app-col').should('not.exist')
      })
      .then(($sheet) => {
        const element = $sheet.get(0) as HTMLElement & {
          f7Modal?: { params?: Record<string, unknown>, close: () => void }
        }
        expect(element.f7Modal?.params?.swipeToClose).to.equal(true)
        expect(element.f7Modal?.params?.swipeHandler).to.equal('.app-sheet-handle')
        element.f7Modal?.close()
      })
    cy.get('.note-more-modal .app-sheet-handle').should('not.be.visible')
    cy.get('.popup.modal-in').should('not.exist')
    cy.window().then((window: Window & { db: any }) => window.db.notes.delete(noteId))
  })

  it('opens long-press options with the native Framework7 Actions component', () => {
    const folderId = 'framework7-actions-folder'
    const now = '2026-08-02 12:00:00.000Z'

    cy.visit('/home')
    cy.window().its('db').should('exist')
    cy.window().then(async (window: Window & { db: any }) => {
      await window.db.notes.put({
        id: folderId,
        title: 'Framework7 Actions 测试',
        summary: '',
        content: '',
        created: now,
        updated: now,
        item_type: 1,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      })
    })

    cy.reload()
    cy.get(`.app-list-item[data-id="${folderId}"]`)
      .should('be.visible')
      .scrollIntoView({ block: 'center' })
      .trigger('contextmenu', { force: true })

    cy.get('#long-press-menu.actions-modal.modal-in')
      .should('be.visible')
      .within(() => {
        cy.get('.actions-group').should('have.length', 2)
        cy.get('.actions-label').should('contain.text', 'Framework7 Actions 测试')
        cy.contains('.actions-button', '重命名').should('be.visible').click()
      })

    cy.get('.dialog.modal-in')
      .should('be.visible')
      .within(() => {
        cy.get('.dialog-title').should('contain.text', '重命名文件夹')
        cy.get('.dialog-input-field .dialog-input')
          .should('be.visible')
          .and('be.focused')
          .and('have.value', 'Framework7 Actions 测试')
        cy.contains('.dialog-button', '取消').click()
      })

    cy.get(`.app-list-item[data-id="${folderId}"]`)
      .trigger('contextmenu', { force: true })
    cy.get('#long-press-menu.actions-modal.modal-in')
      .should('be.visible')
      .within(() => {
        cy.contains('.actions-button', '移动').should('be.visible')
        cy.contains('.actions-button.color-red', '删除').should('be.visible')
        cy.contains('.actions-button-strong', '取消').click()
      })

    cy.get('#long-press-menu.modal-in').should('not.exist')
    cy.get('.long-press-menu, #long-press-menu.app-modal').should('not.exist')
    cy.window().then((window: Window & { db: any }) => window.db.notes.delete(folderId))
  })

  it('keeps note action rows responsive while the sheet is opening', () => {
    const noteId = 'framework7-sheet-action-note'
    const now = '2026-08-02 12:00:00.000Z'

    cy.visit('/home')
    cy.window().its('db').should('exist')
    cy.window().then(async (window: Window & { db: any }) => {
      await window.db.security_settings.clear()
      await window.db.notes.put({
        id: noteId,
        title: 'Framework7 Sheet 操作测试',
        summary: '验证锁定与公开入口',
        content: '<p>Sheet action content</p>',
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

    cy.visit(`/n/${noteId}`)
    cy.get('[data-testid="note-more-trigger"]').should('be.visible').click()
    cy.get('[data-testid="note-more-public-action"]').click()
    cy.get('.dialog.modal-in')
      .should('be.visible')
      .and('contain.text', '请先登录')
      .within(() => cy.contains('.dialog-button', '取消').click())

    cy.get('[data-testid="note-more-lock-action"]').click()
    cy.get('.note-more-modal.modal-in').should('not.exist')
    cy.get('.note-lock-setup-modal.sheet-modal.modal-in')
      .should('be.visible')
      .within(() => {
        cy.get('.list.list-strong.inset').should('have.length', 1)
        cy.get('.item-input.item-input-outline input#note-lock-setup-pin-input')
          .should('be.visible')
          .and('have.attr', 'inputmode', 'numeric')
        cy.get('.note-lock-setup-modal__field').should('not.exist')
      })
    cy.get('.note-lock-setup-modal [aria-label="关闭"]').click()
    cy.window().then((window: Window & { db: any }) => window.db.notes.delete(noteId))
  })

  it('renders the user profile sheet with native Framework7 form components', () => {
    cy.visit('/home')
    cy.window().then((window: Window & { pb: any }) => {
      const payload = window.btoa(JSON.stringify({ exp: 4102444800 }))
      window.pb.authStore.save(`e2e.${payload}.token`, {
        id: 'framework7-profile-user',
        email: 'framework7@example.com',
        username: 'Framework7 用户',
        avatar: '',
        created: '2026-08-02 12:00:00.000Z',
        updated: '2026-08-02 12:00:00.000Z',
      })
    })

    cy.get('[data-testid="user-profile-trigger"]')
      .should('be.visible')
      .click({ scrollBehavior: 'center' })
    cy.get('.user-profile-modal.sheet-modal.modal-in')
      .should('be.visible')
      .within(() => {
        cy.get('.toolbar').should('be.visible')
        cy.get('.page-content').should('be.visible')
        cy.get('.block-title').should('have.length', 3)
        cy.get('.list.list-strong.inset').should('have.length', 3)
        cy.get('.list-item, .item-content').should('have.length.greaterThan', 0)
        cy.get('.block .button').should('have.length', 2)
        cy.get('.app-grid, .app-row, .app-col, .app-label, .app-avatar').should('not.exist')
        cy.contains('.link', '完成').click()
      })
    cy.get('.user-profile-modal.modal-in').should('not.exist')
    cy.window().then((window: Window & { pb: any }) => window.pb.authStore.clear())
  })

  it('opens folders from the row and expands only from the chevron', () => {
    cy.visit('/home')
    cy.get('#app-loading').should('not.exist')
    cy.get('.app-navbar.navbar-large .title-large')
      .should('be.visible')
      .and('contain.text', '备忘录')
    cy.get('.home-navigation-meta .app-button').each(($button) => {
      const buttonRect = $button.get(0).getBoundingClientRect()
      const iconRect = $button.get(0).querySelector('svg')!.getBoundingClientRect()
      expect(buttonRect.height).to.be.at.most(44)
      expect(iconRect.top).to.be.at.least(buttonRect.top)
      expect(iconRect.bottom).to.be.at.most(buttonRect.bottom)
    })
    cy.get('.home-navigation-content .app-large-title').should('not.exist')
    cy.get('.app-navbar.navbar-large .title-large').then(($title) => {
      const titleRect = $title.get(0).getBoundingClientRect()
      cy.get('.home-navigation-content').then(($content) => {
        const content = $content.get(0)
        const contentRect = content.getBoundingClientRect()
        const contentStart = contentRect.top + Number.parseFloat(getComputedStyle(content).paddingTop)
        expect(titleRect.bottom).to.be.at.most(contentStart + 1)
      })
    })
    cy.get('.home-navigation-content .list.accordion-list > ul > li.accordion-item')
      .first()
      .then(($item) => {
        const wasOpened = $item.hasClass('accordion-item-opened')
        cy.wrap($item).find('> .item-link').click('right', { scrollBehavior: 'center' })
        cy.wrap($item).should(wasOpened ? 'not.have.class' : 'have.class', 'accordion-item-opened')
      })

    cy.window().then((window) => {
      const view = window.document.querySelector('.view-main')
      expect(view, 'Framework7 main view').to.not.equal(null)
      const transitionClasses: string[] = []
      const observer = new window.MutationObserver(() => {
        if (view?.classList.contains('router-transition-forward'))
          transitionClasses.push(view.className)
      })
      observer.observe(view!, { attributeFilter: ['class'], attributes: true })
      ;(window as typeof window & { __f7TransitionClasses?: string[], __f7TransitionObserver?: MutationObserver }).__f7TransitionClasses = transitionClasses
      ;(window as typeof window & { __f7TransitionClasses?: string[], __f7TransitionObserver?: MutationObserver }).__f7TransitionObserver = observer
    })

    cy.wait(400)
    cy.get('.home-navigation-content .list.accordion-list > ul > li.accordion-item')
      .first()
      .find('.folder-item-title')
      .click({ scrollBehavior: 'center' })
    cy.url().should('match', /\/f\/[\w-]+$/)
    cy.get('.view-main > .page.page-current .folder-navbar.navbar-large .title-large')
      .should('be.visible')
      .and('not.be.empty')
    cy.get('.view-main > .page.page-current .folder-page-content').should('be.visible')
    cy.get('.view-main > .page.page-current .folder-page-content__body').should('be.visible')
    cy.get('.view-main > .page.page-current .folder-page-content')
      .find('.list.accordion-list, .folder-empty-state')
      .should('be.visible')
    cy.window().then((window) => {
      const transitionWindow = window as typeof window & { __f7TransitionClasses?: string[], __f7TransitionObserver?: MutationObserver }
      transitionWindow.__f7TransitionObserver?.disconnect()
      expect(transitionWindow.__f7TransitionClasses, 'Framework7 forward transition').to.have.length.greaterThan(0)
    })
  })

  it('returns to the hierarchical parent after refreshing a nested folder', () => {
    const parentId = 'framework7-back-parent'
    const childId = 'framework7-back-child'
    const siblingId = 'framework7-back-sibling'
    const now = '2026-08-03 12:00:00.000Z'

    cy.visit('/home')
    cy.get('#app-loading').should('not.exist')
    cy.window().then(async (window: Window & { db: any }) => {
      await window.db.notes.bulkPut([
        {
          id: parentId,
          title: '返回目标父文件夹',
          summary: '',
          content: '',
          created: now,
          updated: now,
          item_type: 1,
          parent_id: '',
          is_deleted: 0,
          is_locked: 0,
          note_count: 2,
          version: 1,
          files: [],
        },
        {
          id: childId,
          title: '刷新后的当前文件夹',
          summary: '',
          content: '',
          created: now,
          updated: now,
          item_type: 1,
          parent_id: parentId,
          is_deleted: 0,
          is_locked: 0,
          note_count: 0,
          version: 1,
          files: [],
        },
        {
          id: siblingId,
          title: '旧历史同级文件夹',
          summary: '',
          content: '',
          created: now,
          updated: now,
          item_type: 1,
          parent_id: parentId,
          is_deleted: 0,
          is_locked: 0,
          note_count: 0,
          version: 1,
          files: [],
        },
      ])
      window.localStorage.setItem('app_navigation_history', JSON.stringify([
        { path: `/f/${parentId}/${siblingId}`, timestamp: Date.now() - 1 },
        { path: `/f/${parentId}/${childId}`, timestamp: Date.now() },
      ]))
    })

    cy.visit(`/f/${parentId}/${childId}`)
    cy.get('.view-main > .page.page-current .folder-navbar .title-large')
      .should('contain.text', '刷新后的当前文件夹')
    cy.window().then((window) => {
      const view = window.document.querySelector('.view-main')
      const transitionClasses: string[] = []
      const observer = new window.MutationObserver(() => {
        if (view?.classList.contains('router-transition-backward'))
          transitionClasses.push(view.className)
      })
      observer.observe(view!, { attributeFilter: ['class'], attributes: true })
      ;(window as typeof window & { __folderBackTransitionClasses?: string[], __folderBackTransitionObserver?: MutationObserver }).__folderBackTransitionClasses = transitionClasses
      ;(window as typeof window & { __folderBackTransitionClasses?: string[], __folderBackTransitionObserver?: MutationObserver }).__folderBackTransitionObserver = observer
    })
    cy.get('.view-main > .page.page-current .folder-navbar .app-back-button').click()

    cy.location('pathname').should('equal', `/f/${parentId}`)
    cy.get('.view-main > .page.page-current .folder-navbar .title-large')
      .should('contain.text', '返回目标父文件夹')
    cy.window().then((window) => {
      const transitionWindow = window as typeof window & { __folderBackTransitionClasses?: string[], __folderBackTransitionObserver?: MutationObserver }
      transitionWindow.__folderBackTransitionObserver?.disconnect()
      expect(transitionWindow.__folderBackTransitionClasses, 'Framework7 backward transition').to.have.length.greaterThan(0)
    })
  })

  it('keeps private and public routes in Framework7 page surfaces', () => {
    cy.visit('/home', {
      onBeforeLoad(window) {
        window.localStorage.setItem('themeMode', 'light')
      },
    })
    cy.get('#app-loading').should('not.exist')
    assertStandardPageStructure()

    cy.get('.view-main').then(($view) => {
      const view = ($view[0] as HTMLElement & { f7View?: { router: { navigate: (url: string) => void } } }).f7View
      expect(Boolean(view), 'Framework7 main view').to.equal(true)
      view!.router.navigate('/voidvon', { animate: false })
    })
    cy.url().should('include', '/voidvon')
    assertStandardPageStructure()

    cy.get('.view-main').then(($view) => {
      const view = ($view[0] as HTMLElement & { f7View?: { router: { navigate: (url: string) => void } } }).f7View
      expect(Boolean(view), 'Framework7 main view').to.equal(true)
      view!.router.navigate('/voidvon/f/allnotes', { animate: false })
    })
    cy.url().should('include', '/voidvon/f/allnotes')
    assertStandardPageStructure()
    cy.get('.app-navbar > .navbar-inner').should('be.visible')
  })

  it('keeps desktop panes inside one routed Framework7 page', () => {
    cy.viewport(1280, 800)
    cy.visit('/home')
    cy.get('.view-main > .page.page-current').should('have.length', 1)
    cy.get('.view-main > .page.page-current').within(() => {
      cy.root().find('.page').should('have.length', 0)
      cy.root().find('.app-page-embedded').should('have.length.at.least', 2)
    })
  })
})
