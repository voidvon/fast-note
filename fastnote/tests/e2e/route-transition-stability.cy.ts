type TransitionTestWindow = Window & {
  __routeTransitionObserver?: MutationObserver
  __routeTransitionChildMutations?: () => number
  __routeTransitionStarted?: () => boolean
}

function isRouteTransitioning(viewElement?: Element | null) {
  return viewElement?.classList.contains('router-transition') === true
    || viewElement?.classList.contains('router-transition-custom') === true
}

function observeRouteTransition(window: Cypress.AUTWindow) {
  const viewElement = window.document.querySelector<HTMLElement>('.view-main')
  let childMutationsDuringTransition = 0
  let transitionStarted = false
  const observer = new window.MutationObserver((records) => {
    if (!isRouteTransitioning(viewElement))
      return

    transitionStarted = true
    childMutationsDuringTransition += records.reduce((count, record) => (
      record.type === 'childList'
        ? count + record.addedNodes.length + record.removedNodes.length
        : count
    ), 0)
  })

  observer.observe(viewElement!, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true,
  })
  const transitionWindow = window as TransitionTestWindow
  transitionWindow.__routeTransitionObserver = observer
  transitionWindow.__routeTransitionChildMutations = () => childMutationsDuringTransition
  transitionWindow.__routeTransitionStarted = () => transitionStarted
}

function assertStableRouteTransition(label: string) {
  cy.get('.view-main').should($view => expect(isRouteTransitioning($view[0]), `${label} started`).to.equal(true))
  cy.get('.view-main').should($view => expect(isRouteTransitioning($view[0]), `${label} finished`).to.equal(false))
  cy.window().then((window) => {
    const transitionWindow = window as TransitionTestWindow
    transitionWindow.__routeTransitionObserver?.disconnect()
    expect(transitionWindow.__routeTransitionStarted?.(), label).to.equal(true)
    expect(transitionWindow.__routeTransitionChildMutations?.(), label).to.equal(0)
  })
}

describe('mobile route transition stability', () => {
  beforeEach(() => {
    cy.viewport(374, 600)
    cy.visit('/home')
    cy.get('#app-loading').should('not.exist')
  })

  it('animates stable pages between home, folders, and note detail', () => {
    cy.window().then((window) => {
      const viewElement = window.document.querySelector<HTMLElement & {
        f7View?: { router: { params: Record<string, unknown> } }
      }>('.view-main')

      expect(viewElement?.f7View?.router.params.animate).to.equal(true)
      expect(viewElement?.f7View?.router.params.iosPageLoadDelay).to.equal(80)
      expect(viewElement?.f7View?.router.params.mdPageLoadDelay).to.equal(80)
      expect(viewElement?.f7View?.router.params.browserHistoryInitialMatch).to.equal(true)
      observeRouteTransition(window)
    })

    cy.contains('.home-navigation .message-list-item', '全部备忘录').click()
    cy.location('pathname').should('equal', '/f/allnotes')
    assertStableRouteTransition('home to all notes')

    cy.window().then((window) => {
      observeRouteTransition(window)
      const viewElement = window.document.querySelector<HTMLElement & {
        f7View?: { router: { navigate: (url: string) => void } }
      }>('.view-main')
      viewElement?.f7View?.router.navigate('/n/0')
    })
    cy.location('pathname').should('equal', '/n/0')
    assertStableRouteTransition('all notes to note detail')

    cy.window().then(observeRouteTransition)
    cy.get('.page-current .app-back-button').click()
    cy.location('pathname').should('equal', '/f/allnotes')
    assertStableRouteTransition('note detail back to all notes')

    cy.window().then(observeRouteTransition)
    cy.get('.page-current .app-back-button').click()
    cy.location('pathname').should('equal', '/home')
    assertStableRouteTransition('all notes back to home')
  })

  it('preloads home before animating back from refreshed all notes', () => {
    cy.contains('.home-navigation .message-list-item', '全部备忘录').click()
    cy.location('pathname').should('equal', '/f/allnotes')
    cy.reload()
    cy.get('#app-loading').should('not.exist')
    cy.contains('.page-current', '全部备忘录').should('exist')
    cy.get('.view-main > .page-previous .home-navigation').should('exist')
    cy.window().then(observeRouteTransition)

    cy.get('.page-current .app-back-button').click()
    cy.location('pathname').should('equal', '/home')
    assertStableRouteTransition('refreshed all notes back to home')
  })

  it('preloads the fallback before animating back from a direct entry', () => {
    cy.visit('/f/allnotes', {
      onBeforeLoad(window) {
        window.localStorage.removeItem('f7router-view_main-history')
      },
    })
    cy.get('#app-loading').should('not.exist')
    cy.contains('.page-current', '全部备忘录').should('exist')
    cy.get('.view-main > .page-previous').should('not.exist')
    cy.window().then(observeRouteTransition)

    cy.get('.page-current .app-back-button').click()
    cy.location('pathname').should('equal', '/home')
    assertStableRouteTransition('direct all notes back to home')
  })
})
