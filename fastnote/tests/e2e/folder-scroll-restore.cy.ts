describe('T-FN-scroll restore across nested folders', () => {
  const folderAId = 'e2e-folder-a'
  const folderBId = 'e2e-folder-b'
  const folderATitle = 'E2E 列表 A'
  const folderBTitle = 'E2E 列表 B'
  const noteInBId = 'e2e-folder-b-note-13'

  function buildNote(params: {
    id: string
    title: string
    parentId?: string
    itemType?: number
    summary?: string
  }) {
    const now = '2026-03-13 15:30:00.000Z'

    return {
      id: params.id,
      title: params.title,
      summary: params.summary || '',
      content: '<p>e2e scroll restore</p>',
      created: now,
      updated: now,
      item_type: params.itemType ?? 2,
      parent_id: params.parentId ?? '',
      is_deleted: 0,
      is_locked: 0,
      note_count: 0,
      version: 1,
      files: [],
    }
  }

  function expectContentScrollTop(expected: number) {
    return cy.get('.page-current .folder-page-content').should(($content) => {
      expect($content.get(0).scrollTop).to.equal(expected)
    })
  }

  function expectContentScrollTopAtLeast(minimum: number) {
    return cy.get('.page-current .folder-page-content').should(($content) => {
      expect($content.get(0).scrollTop).to.be.at.least(minimum)
    })
  }

  function setContentScrollTop(top: number) {
    return cy.get('.page-current .folder-page-content').then(($content) => {
      const scrollElement = $content.get(0)
      scrollElement.scrollTop = top
      scrollElement.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
  }

  function seedNestedFolders() {
    cy.window().then(async (win: Window & { db: any }) => {
      await win.db.notes.clear()
      await win.db.note_files.clear()

      const records = [
        buildNote({
          id: folderAId,
          title: folderATitle,
          itemType: 1,
        }),
        buildNote({
          id: folderBId,
          title: folderBTitle,
          parentId: folderAId,
          itemType: 1,
        }),
      ]

      for (let i = 0; i < 18; i += 1) {
        records.push(buildNote({
          id: `e2e-folder-a-note-${i}`,
          title: `A 填充笔记 ${i}`,
          parentId: folderAId,
          summary: `A summary ${i}`,
        }))
      }

      for (let i = 0; i < 18; i += 1) {
        records.push(buildNote({
          id: `e2e-folder-b-note-${i}`,
          title: `B 填充笔记 ${i}`,
          parentId: folderBId,
          summary: `B summary ${i}`,
        }))
      }

      await win.db.notes.bulkPut(records)
    })
  }

  beforeEach(() => {
    cy.viewport(390, 844)
    cy.visit('/home')
    cy.window().its('db').should('exist')
    seedNestedFolders()
    cy.reload()
  })

  it('restores child and parent folder scroll positions independently', () => {
    cy.get('.page-current').contains(folderATitle).click()
    cy.url().should('include', `/f/${folderAId}`)
    cy.get('.page-current .folder-navbar').should('contain.text', folderATitle)
    cy.get('.view-main').should(($view) => {
      const viewElement = $view.get(0) as HTMLElement & {
        f7View?: { router: { allowPageChange: boolean } }
      }
      expect(viewElement.f7View?.router.allowPageChange).to.equal(true)
    })

    setContentScrollTop(380)
    expectContentScrollTopAtLeast(300)

    cy.get('.view-main').then(($view) => {
      const viewElement = $view.get(0) as HTMLElement & {
        f7View?: { router: { navigate: (url: string) => void } }
      }
      expect(viewElement.f7View).not.to.equal(undefined)
      viewElement.f7View!.router.navigate(`/f/${folderAId}/${folderBId}`)
    })
    cy.url().should('include', `/f/${folderAId}/${folderBId}`)
    cy.get('.page-current .folder-navbar').should('contain.text', folderBTitle)
    cy.window()
      .its('sessionStorage')
      .invoke('getItem', `page-scroll:private:/f/${folderAId}`)
      .should('equal', '380')
    expectContentScrollTop(0)

    cy.get('.view-main').should(($view) => {
      const viewElement = $view.get(0) as HTMLElement & {
        f7View?: { router: { allowPageChange: boolean } }
      }
      expect(viewElement.f7View?.router.allowPageChange).to.equal(true)
    })

    setContentScrollTop(520)
    expectContentScrollTopAtLeast(450)

    cy.get('.view-main').then(($view) => {
      const viewElement = $view.get(0) as HTMLElement & {
        f7View?: { router: { navigate: (url: string) => void } }
      }
      expect(viewElement.f7View).not.to.equal(undefined)
      viewElement.f7View!.router.navigate(`/n/${noteInBId}`)
    })
    cy.url().should('include', `/n/${noteInBId}`)
    cy.get('.page-current.note-detail').should('exist')
    cy.window()
      .its('sessionStorage')
      .invoke('getItem', `page-scroll:private:/f/${folderAId}/${folderBId}`)
      .should('equal', '520')

    cy.get('.page-current.note-detail .app-back-button').should('be.visible').click()
    cy.url().should('include', `/f/${folderAId}/${folderBId}`)
    cy.get('.page-current .folder-navbar').should('contain.text', folderBTitle)
    expectContentScrollTopAtLeast(450)

    cy.get('.page-current .folder-navbar .app-back-button').should('be.visible').click()
    cy.url().should('include', `/f/${folderAId}`)
    cy.get('.page-current .folder-navbar').should('contain.text', folderATitle)
    expectContentScrollTopAtLeast(300)
  })
})
