describe('Framework7 login page', () => {
  for (const viewport of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 390, height: 844 }]) {
    it(`submits with Enter and displays authentication errors on ${viewport.name}`, () => {
      cy.viewport(viewport.width, viewport.height)
      cy.intercept('POST', '**/api/collections/users/auth-with-password', {
        statusCode: 400,
        body: { code: 400, message: '邮箱或密码错误', data: {} },
      }).as('login')
      cy.visit('/login')

      cy.get('.fastnote-login-page .list .item-input').should('have.length', 2)
      cy.get('.fastnote-login-page button[type="submit"]')
        .should('have.class', 'button-fill')
        .and('have.class', 'button-large')
        .and('have.class', 'button-round')
        .and('have.class', 'disabled')
        .should(($button) => {
          const style = getComputedStyle($button[0])
          const buttonBounds = $button[0].getBoundingClientRect()
          const listBounds = $button[0].closest('form')!.querySelector('.list')!.getBoundingClientRect()
          expect(Number.parseFloat(style.borderTopLeftRadius)).to.be.at.least(
            buttonBounds.height / 2,
          )
          expect(buttonBounds.left).to.be.closeTo(listBounds.left, 1)
          expect(buttonBounds.right).to.be.closeTo(listBounds.right, 1)
        })
      cy.get('#login-email').type('reader@example.com')
      cy.get('#login-password').type('test-password{enter}')
      cy.wait('@login').its('request.body').should('include', {
        identity: 'reader@example.com',
        password: 'test-password',
      })
      cy.get('.fastnote-login-page [role="alert"]').should('contain.text', '邮箱或密码错误')
      cy.get('#login-password').should('not.be.disabled')
      cy.get('.fastnote-login-page button[type="submit"]').should('not.have.class', 'disabled')
      cy.screenshot(`login-framework7-${viewport.name}`)

      cy.contains('.fastnote-login-page button', '立即注册').click()
      cy.location('pathname').should('eq', '/register')
    })

    for (const savedRoute of ['/deleted', '/n/previous-note']) {
      it(`keeps /login after refresh with saved route ${savedRoute} on ${viewport.name}`, () => {
        cy.viewport(viewport.width, viewport.height)
        cy.visit('/login', {
          onBeforeLoad(win) {
            win.localStorage.setItem('flashnote_last_visited_route:guest', savedRoute)
          },
        })
        cy.get('#login-email').should('be.visible')
        cy.location('pathname').should('eq', '/login')

        cy.reload()

        cy.get('#login-email').should('be.visible')
        cy.get('.fastnote-login-page button[type="submit"]').should('be.visible')
        cy.location('pathname').should('eq', '/login')
        cy.window().then((win) => {
          expect(win.localStorage.getItem('flashnote_last_visited_route:guest')).to.eq(savedRoute)
        })
      })
    }
  }
})
