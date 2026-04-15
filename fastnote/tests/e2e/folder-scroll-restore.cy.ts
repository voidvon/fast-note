describe('T-FN-scroll restore across nested folders', () => {
  const folderAId = 'e2e-folder-a'
  const folderBId = 'e2e-folder-b'
  const folderATitle = 'E2E 列表 A'
  const folderBTitle = 'E2E 列表 B'
  const noteInBId = 'e2e-note-b-target'
  const noteInBTitle = 'E2E B 详情目标'

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

  function getContentScrollTop() {
    return cy.get('ion-content').then(($content) => {
      const ionContent = $content.get(0) as HTMLElement & {
        shadowRoot?: ShadowRoot
      }
      const scrollEl = ionContent.shadowRoot?.querySelector('.inner-scroll') as HTMLElement | null

      expect(scrollEl, 'ion-content inner scroll element').to.not.equal(null)
      return (scrollEl as HTMLElement).scrollTop
    })
  }

  function setContentScrollTop(top: number) {
    return cy.get('ion-content').then(($content) => {
      const ionContent = $content.get(0) as HTMLElement & {
        shadowRoot?: ShadowRoot
      }
      const scrollEl = ionContent.shadowRoot?.querySelector('.inner-scroll') as HTMLElement | null

      expect(scrollEl, 'ion-content inner scroll element').to.not.equal(null)
      ;(scrollEl as HTMLElement).scrollTop = top
      ;(scrollEl as HTMLElement).dispatchEvent(new Event('scroll', { bubbles: true }))
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
        buildNote({
          id: noteInBId,
          title: noteInBTitle,
          parentId: folderBId,
          summary: '目标详情笔记',
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
    cy.contains(folderATitle).click()
    cy.url().should('include', `/f/${folderAId}`)

    setContentScrollTop(380)
    getContentScrollTop().should('be.gte', 300)

    cy.contains(folderBTitle).click()
    cy.url().should('include', `/f/${folderAId}/${folderBId}`)
    getContentScrollTop().should('eq', 0)

    setContentScrollTop(520)
    getContentScrollTop().should('be.gte', 450)

    cy.contains(noteInBTitle).click()
    cy.url().should('include', `/n/${noteInBId}`)

    cy.go('back')
    cy.url().should('include', `/f/${folderAId}/${folderBId}`)
    getContentScrollTop().should('be.gte', 450)

    cy.go('back')
    cy.url().should('include', `/f/${folderAId}`)
    getContentScrollTop().should('be.gte', 300)
  })
})
