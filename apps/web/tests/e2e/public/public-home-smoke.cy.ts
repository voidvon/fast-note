describe('public route smoke', () => {
  it('redirects root path to /home', () => {
    cy.visit('/')
    cy.url().should('include', '/home')
  })
})
