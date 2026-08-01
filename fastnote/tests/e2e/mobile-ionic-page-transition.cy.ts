describe('mobile Ionic page transitions', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
  })

  function assertStandardPageStructure() {
    cy.get('ion-router-outlet > .ion-page:not(.ion-page-hidden)').should('have.length', 1).within(() => {
      cy.root().children('ion-header').should('have.length', 1)
      cy.root().children('ion-content').should('have.length', 1)
    })
  }

  it('keeps private and public home content in the Ionic transition surface', () => {
    cy.visit('/home', {
      onBeforeLoad(window) {
        window.localStorage.setItem('themeMode', 'light')
      },
    })
    cy.get('#app-loading').should('not.exist')
    assertStandardPageStructure()

    cy.visit('/voidvon')
    cy.get('#app-loading').should('not.exist')
    assertStandardPageStructure()

    cy.get('ion-router-outlet > .ion-page:not(.ion-page-hidden)').children('ion-content').then(($content) => {
      const leavingContent = $content[0]
      const leavingLargeTitle = leavingContent.querySelector('ion-title.title-large') as HTMLElement | null

      cy.window().then(async (win) => {
        await (win as any).__VUE_APP__.config.globalProperties.$router.push('/voidvon/f/allnotes')

        const deadline = win.performance.now() + 1000
        let hasStandardContentAnimation = false
        let hasLargeTitleAnimation = false
        const transitionToolbarBackgrounds = new Set<string>()
        const clonedNavigationColors = new Set<string>()

        const colorProbe = win.document.createElement('span')
        colorProbe.style.color = 'var(--c-text-primary)'
        win.document.body.appendChild(colorProbe)
        const neutralColor = win.getComputedStyle(colorProbe).color
        colorProbe.remove()

        while ((!hasStandardContentAnimation || !hasLargeTitleAnimation) && win.performance.now() < deadline) {
          const animations = win.document.getAnimations()
          win.document
            .querySelectorAll<HTMLElement>('ion-header.header-collapse-condense-inactive.header-transitioning:not(.header-collapse-condense) ion-toolbar')
            .forEach((toolbar) => {
              transitionToolbarBackgrounds.add(
                win.getComputedStyle(toolbar).getPropertyValue('--background').trim(),
              )
            })
          win.document
            .querySelectorAll<HTMLElement>('ion-back-button.ion-cloned-element, ion-title.ion-cloned-element')
            .forEach((element) => {
              const styles = win.getComputedStyle(element)
              if (styles.display !== 'none') {
                clonedNavigationColors.add(styles.color)
              }
            })
          hasStandardContentAnimation = animations.some((animation) => {
            const effect = animation.effect as KeyframeEffect | null
            return effect?.target === leavingContent && effect.getTiming().duration === 540
          })
          hasLargeTitleAnimation = leavingLargeTitle?.style.opacity === '0'
            || animations.some((animation) => {
              const target = (animation.effect as KeyframeEffect | null)?.target as HTMLElement | null
              return target?.matches('ion-title.ion-cloned-element') === true
            })

          if (!hasStandardContentAnimation || !hasLargeTitleAnimation) {
            await new Promise(resolve => win.setTimeout(resolve, 16))
          }
        }

        expect(hasStandardContentAnimation).to.equal(true)
        expect(hasLargeTitleAnimation).to.equal(true)
        expect([...transitionToolbarBackgrounds]).to.deep.equal(['#f0f0f2'])
        expect([...clonedNavigationColors]).to.deep.equal([neutralColor])
      })
    })

    cy.get('ion-router-outlet > .ion-page:not(.ion-page-hidden)').children('ion-header').find('ion-toolbar').should(($toolbar) => {
      const toolbar = $toolbar.get(0)
      const backButton = toolbar.querySelector('ion-back-button')
      const colorProbe = document.createElement('span')

      colorProbe.style.color = 'var(--c-text-primary)'
      document.body.appendChild(colorProbe)
      const neutralColor = getComputedStyle(colorProbe).color
      colorProbe.remove()

      expect(getComputedStyle(toolbar).color).to.equal(neutralColor)
      expect(getComputedStyle(backButton!).color).to.equal(neutralColor)
    })
  })
})
