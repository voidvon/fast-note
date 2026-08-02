describe('unfiled notes Framework7 list', () => {
  const noteId = 'framework7-unfiled-list-note'
  const noteTitle = 'Framework7 备忘录列表项'
  const noteSummary = '使用原生 media item 展示摘要'
  const lockedNoteId = 'framework7-locked-list-note'

  beforeEach(() => {
    cy.viewport(390, 844)
    cy.visit('/home')
    cy.window().its('db').should('exist')
    cy.window().then(async (window: Window & { db: any }) => {
      await window.db.notes.clear()
      await window.db.note_files.clear()
      await window.db.notes.bulkPut([
        {
          id: noteId,
          title: noteTitle,
          summary: noteSummary,
          content: '<p>Framework7 native list item</p>',
          created: '2024-01-02 03:04:05.000Z',
          updated: '2024-01-02 03:04:05.000Z',
          item_type: 2,
          parent_id: '',
          is_deleted: 0,
          is_locked: 0,
          note_count: 0,
          version: 1,
          files: [],
        },
        {
          id: lockedNoteId,
          title: '锁定备忘录',
          summary: '标题左侧显示小锁',
          content: '<p>Locked note</p>',
          created: '2024-01-03 03:04:05.000Z',
          updated: '2024-01-03 03:04:05.000Z',
          item_type: 2,
          parent_id: '',
          is_deleted: 0,
          is_locked: 1,
          note_count: 0,
          version: 1,
          files: [],
        },
      ])
    })
    cy.visit('/f/unfilednotes')
    cy.get('#app-loading').should('not.exist')
  })

  it('renders the date before the summary in one Framework7 text region', () => {
    cy.get(`.app-list-item.media-item[data-id="${noteId}"]`)
      .should('be.visible')
      .parents('.list.media-list.list-strong.inset')
      .should('have.length', 1)
      .find('> ul')
      .then(($list) => {
        const style = getComputedStyle($list.get(0))
        expect(Number.parseFloat(style.borderRadius)).to.be.greaterThan(0)
        expect(style.backgroundColor).not.to.equal('rgba(0, 0, 0, 0)')
      })

    cy.get(`.app-list-item.media-item[data-id="${noteId}"]`)
      .within(() => {
        cy.get('.item-title')
          .should('have.text', noteTitle)
          .and('have.css', 'font-size', '18px')
        cy.get('.item-subtitle').should('not.exist')
        cy.get('.item-text').invoke('text').then((preview) => {
          expect(preview).to.contain('2024/1/2')
          expect(preview).to.contain(noteSummary)
          expect(preview.indexOf('2024/1/2')).to.be.lessThan(preview.indexOf(noteSummary))
        })
        cy.get('.note-label, h2, p').should('not.exist')
      })
  })

  it('aligns the smaller folder icon with the native Framework7 footer text', () => {
    cy.visit('/f/allnotes')
    cy.get('#app-loading').should('not.exist')

    cy.get(`.app-list-item.media-item[data-id="${noteId}"] .item-footer`)
      .should('contain.text', '备忘录')
      .then(($footer) => {
        const footerRect = $footer.get(0).getBoundingClientRect()
        const iconRect = $footer.get(0).querySelector('.note-folder-icon')!.getBoundingClientRect()

        expect(iconRect.width).to.equal(12)
        expect(iconRect.height).to.equal(12)
        expect(Math.abs((iconRect.top + iconRect.height / 2) - (footerRect.top + footerRect.height / 2))).to.be.at.most(1)
      })
  })

  it('places the small lock before the title without reserving a media column', () => {
    const unlockedSelector = `.app-list-item[data-id="${noteId}"]`
    const lockedSelector = `.app-list-item[data-id="${lockedNoteId}"]`

    cy.get(unlockedSelector).within(() => {
      cy.get('.item-media, .note-lock-icon').should('not.exist')
    })

    cy.get(lockedSelector).within(() => {
      cy.get('.item-media').should('not.exist')
      cy.get('.item-title-row > .note-lock-icon')
        .should('be.visible')
        .then(($icon) => {
          const iconRect = $icon.get(0).getBoundingClientRect()
          expect(iconRect.width).to.equal(13)
          expect(iconRect.height).to.equal(13)

          cy.get('.item-title-row > .item-title').then(($title) => {
            const titleRect = $title.get(0).getBoundingClientRect()
            expect(titleRect.left - iconRect.right).to.equal(4)
            expect(Math.abs((iconRect.top + iconRect.height / 2) - (titleRect.top + titleRect.height / 2))).to.be.at.most(1)
          })
        })
    })

    cy.get(`${unlockedSelector} .item-inner`).then(($unlockedInner) => {
      cy.get(`${lockedSelector} .item-inner`).then(($lockedInner) => {
        expect($lockedInner.get(0).getBoundingClientRect().left).to.equal($unlockedInner.get(0).getBoundingClientRect().left)
      })
    })
  })
})
