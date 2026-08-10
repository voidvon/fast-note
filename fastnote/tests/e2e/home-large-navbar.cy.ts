describe('home large navbar', () => {
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1280, height: 800 },
  ]) {
    it(`uses a stable layered navbar layout for ${viewport.name} navigation`, () => {
      cy.viewport(viewport.width, viewport.height)
      cy.visit('/home')
      cy.get('#app-loading').should('not.exist')

      cy.get('.home-navbar').then(($navbar) => {
        const navbar = $navbar.get(0)
        const navbarRect = navbar.getBoundingClientRect()

        expect(getComputedStyle(navbar).position).to.equal('relative')

        cy.get('.home-navigation-content').then(($content) => {
          const content = $content.get(0)
          const contentRect = content.getBoundingClientRect()
          const contentStyles = getComputedStyle(content)
          expect(contentRect.top).to.equal(navbarRect.top)
          expect(Number.parseFloat(contentStyles.paddingTop)).to.equal(
            navbarRect.height + Number.parseFloat(contentStyles.getPropertyValue('--f7-navbar-large-title-height')),
          )
        })
      })
    })
  }

  it('collapses the official large title when its pane scrolls', () => {
    cy.viewport(1280, 800)
    cy.visit('/home')
    cy.get('#app-loading').should('not.exist')
    cy.get('.home-navbar.navbar-large').should('not.have.class', 'navbar-large-collapsed')
    cy.get('.home-navigation-content').then(($content) => {
      const spacer = document.createElement('div')
      spacer.style.height = '1000px'
      $content.get(0).append(spacer)
    })
    cy.get('.home-navigation-content').scrollTo(0, 80, { duration: 0 })
    cy.get('.home-navbar.navbar-large').should('have.class', 'navbar-large-collapsed')
    cy.get('.home-navigation-content').scrollTo(0, 0, { duration: 0 })
    cy.get('.home-navbar.navbar-large').should('not.have.class', 'navbar-large-collapsed')
  })

  it('collapses the mobile home title into the navbar when its pane scrolls', () => {
    cy.viewport(390, 844)
    cy.visit('/home')
    cy.get('#app-loading').should('not.exist')
    cy.get('.home-navbar.navbar-large').should('not.have.class', 'navbar-large-collapsed')
    cy.get('.home-navigation-content').then(($content) => {
      const spacer = document.createElement('div')
      spacer.style.height = '1000px'
      $content.get(0).append(spacer)
    })
    cy.get('.home-navigation-content').scrollTo(0, 80, { duration: 0 })
    cy.get('.home-navbar.navbar-large').should('have.class', 'navbar-large-collapsed')
    cy.get('.home-navigation-content').scrollTo(0, 0, { duration: 0 })
    cy.get('.home-navbar.navbar-large').should('not.have.class', 'navbar-large-collapsed')
  })

  it('keeps the home navbar height stable across desktop viewport heights', () => {
    for (const height of [600, 800, 1000]) {
      cy.viewport(1280, height)
      cy.visit('/home')
      cy.get('#app-loading').should('not.exist')
      cy.get('.home-navbar').then(($navbar) => {
        const navbar = $navbar.get(0)
        const styles = getComputedStyle(navbar)
        const expectedHeight = Number.parseFloat(styles.getPropertyValue('--f7-navbar-height'))
        expect(navbar.getBoundingClientRect().height).to.be.closeTo(expectedHeight, 0.5)
      })
    }
  })

  it('shows a native navbar above each desktop middle-pane list', () => {
    cy.viewport(1280, 800)

    function assertMiddlePaneNavbar(title: string, large = true) {
      cy.get('.home-list .navbar')
        .should('be.visible')
        .and('contain.text', title)
        .then(($navbar) => {
          const navbar = $navbar.get(0)
          const navbarRect = navbar.getBoundingClientRect()
          const navbarBackground = navbar.querySelector('.navbar-bg')

          expect(navbar.classList.contains('navbar-large')).to.equal(large)
          expect(getComputedStyle(navbar).position).to.equal('relative')
          expect(getComputedStyle(navbarBackground!, '::before').backdropFilter).to.contain('blur')

          cy.get('.home-list .app-content').then(($content) => {
            const content = $content.get(0)
            const contentRect = content.getBoundingClientRect()
            const contentStyles = getComputedStyle(content)
            let expectedPadding = navbarRect.height
            if (large) {
              expectedPadding += Number.parseFloat(
                contentStyles.getPropertyValue('--f7-navbar-large-title-height'),
              )
            }

            expect(contentRect.top).to.equal(navbarRect.top)
            expect(Number.parseFloat(contentStyles.paddingTop)).to.equal(expectedPadding)
          })
        })
    }

    cy.visit('/f/allnotes')
    cy.get('#app-loading').should('not.exist')
    assertMiddlePaneNavbar('全部备忘录')

    cy.window().then(async (win: Window & { db: any }) => {
      const now = new Date().toISOString()
      await win.db.notes.put({
        id: 'desktop-middle-navbar-deleted-note',
        title: '用于显示最近删除入口',
        summary: '',
        content: '<p>已删除</p>',
        created: now,
        updated: now,
        item_type: 2,
        parent_id: '',
        is_deleted: 1,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      })
    })
    cy.reload()
    cy.get('#app-loading').should('not.exist')
    cy.get('.home-navigation').contains('最近删除').click()
    assertMiddlePaneNavbar('最近删除', false)
  })
})
