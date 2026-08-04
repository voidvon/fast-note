import type { Component, ComponentPublicInstance, InjectionKey, PropType, Ref } from 'vue'
import {
  f7,
  f7AccordionContent,
  f7Actions,
  f7ActionsButton,
  f7ActionsGroup,
  f7ActionsLabel,
  f7Block,
  f7BlockTitle,
  f7Button,
  f7Chip,
  f7Input,
  f7Link,
  f7List,
  f7ListInput,
  f7ListItem,
  f7Navbar,
  f7NavLeft,
  f7NavRight,
  f7NavTitle,
  f7NavTitleLarge,
  f7Page,
  f7PageContent,
  f7Popover,
  f7Preloader,
  f7Searchbar,
  f7Sheet,
  f7SkeletonText,
  f7Toggle,
  f7Toolbar,
  f7ToolbarPane,
} from 'framework7-vue'
import {
  computed,
  defineComponent,
  Fragment,
  getCurrentInstance,
  h,
  inject,
  mergeProps,
  nextTick,
  normalizeClass,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch,
} from 'vue'
import { useAppRouter as useFramework7AppRouter } from '@/shared/lib/framework7'

export { useAppRoute, useAppRouter } from '@/shared/lib/framework7'
export { f7App as F7App } from 'framework7-vue'

type AnyRecord = Record<string, any>
export type AlertButton = string | {
  text: string
  role?: string
  cssClass?: string
  handler?: (value: AnyRecord) => unknown
}
type OverlayButton = AlertButton

function passthroughComponent(name: string, tag: string, className: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, mergeProps(attrs, { class: [className, attrs.class] }), slots.default?.())
    },
  })
}

interface NavigationBarContext {
  kind: 'navbar' | 'footer' | 'large-title'
  toolbarClass: Ref<unknown>
}
const navigationBarContextKey: InjectionKey<NavigationBarContext> = Symbol('f7-navigation-bar')
const pageSurfaceContextKey: InjectionKey<'route' | 'embedded'> = Symbol('f7-page-surface')

export const F7Page = defineComponent({
  name: 'F7Page',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const embedded = inject(pageSurfaceContextKey, undefined) !== undefined
    provide(pageSurfaceContextKey, embedded ? 'embedded' : 'route')
    if (embedded) {
      return () => h('div', mergeProps(attrs, {
        class: ['app-page-embedded', attrs.class],
      }), slots.default?.())
    }
    return () => h(f7Page, mergeProps(attrs, {
      pageContent: false,
      class: ['app-page', attrs.class],
    }), slots)
  },
})

export const F7Header = defineComponent({
  name: 'F7Header',
  inheritAttrs: false,
  props: {
    hideLeft: Boolean,
    hideRight: Boolean,
    native: Boolean,
  },
  setup(props, { attrs, slots }) {
    const embedded = inject(pageSurfaceContextKey, undefined) === 'embedded'
    const toolbarClass = ref<unknown>()
    const condensed = attrs.collapse === 'condense'
    provide(navigationBarContextKey, {
      kind: condensed ? 'large-title' : 'navbar',
      toolbarClass,
    })
    return () => {
      const nextAttrs = { ...attrs }
      const collapse = nextAttrs.collapse
      delete nextAttrs.collapse
      delete nextAttrs.native
      if (collapse === 'condense') {
        return h('div', mergeProps(nextAttrs, {
          class: ['title-large', toolbarClass.value, attrs.class],
        }), slots.default?.())
      }
      if (embedded && !props.native) {
        return h('div', mergeProps(nextAttrs, {
          class: ['app-pane-navbar', 'app-toolbar', toolbarClass.value, attrs.class],
        }), slots.default?.())
      }
      const navbarSlots: Record<string, any> = { ...slots }
      if (props.hideLeft) {
        delete navbarSlots.left
        delete navbarSlots['nav-left']
      }
      if (props.hideRight) {
        delete navbarSlots.right
        delete navbarSlots['nav-right']
      }

      return h(f7Navbar, mergeProps(nextAttrs, {
        class: [embedded ? 'app-pane-navbar' : 'app-navbar', attrs.class],
        innerClass: normalizeClass(['app-toolbar', toolbarClass.value]),
      }), navbarSlots)
    }
  },
})

export const F7Footer = defineComponent({
  name: 'F7Footer',
  inheritAttrs: false,
  props: {
    native: Boolean,
  },
  setup(props, { attrs, slots }) {
    const embedded = inject(pageSurfaceContextKey, undefined) === 'embedded'
    const toolbarClass = ref<unknown>()
    provide(navigationBarContextKey, { kind: 'footer', toolbarClass })
    if (embedded && !props.native) {
      return () => h('div', mergeProps(attrs, {
        class: ['app-pane-footer', attrs.class],
      }), slots.default?.())
    }
    return () => h(f7Toolbar, mergeProps(attrs, {
      bottom: true,
      class: ['app-footer', toolbarClass.value, attrs.class],
    }), slots)
  },
})

export const F7Toolbar = defineComponent({
  name: 'F7Toolbar',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const context = inject(navigationBarContextKey, undefined)
    if (context) {
      context.toolbarClass.value = attrs.class
      return () => slots.default?.()
    }
    return () => h(f7Toolbar, mergeProps(attrs, { class: ['app-toolbar', attrs.class] }), slots)
  },
})

export const F7Buttons = defineComponent({
  name: 'F7Buttons',
  inheritAttrs: false,
  props: {
    position: String as PropType<'start' | 'end'>,
  },
  setup(props, { attrs, slots }) {
    const context = inject(navigationBarContextKey, undefined)
    return () => {
      if (context?.kind === 'navbar') {
        const component = props.position === 'start' ? f7NavLeft : f7NavRight
        return h(component, mergeProps(attrs, {
          class: ['app-button-group', attrs.class],
        }), slots)
      }
      return h('div', mergeProps(attrs, {
        class: [props.position === 'start' ? 'left' : props.position === 'end' ? 'right' : '', 'app-button-group', attrs.class],
      }), slots.default?.())
    }
  },
})

export const F7Title = defineComponent({
  name: 'F7Title',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const context = inject(navigationBarContextKey, undefined)
    const large = attrs.size === 'large'
    const nextAttrs = { ...attrs }
    delete nextAttrs.size
    return () => {
      if (context?.kind === 'navbar') {
        return h(large ? f7NavTitleLarge : f7NavTitle, mergeProps(nextAttrs, {
          class: ['app-title', attrs.class],
        }), slots)
      }
      if (context?.kind === 'large-title' && large) {
        return h('div', mergeProps(nextAttrs, {
          class: ['title-large-text', attrs.class],
        }), slots.default?.())
      }
      return h('div', mergeProps(nextAttrs, {
        class: [large ? 'app-title--large' : 'title', 'app-title', attrs.class],
      }), slots.default?.())
    }
  },
})
export const F7Label = passthroughComponent('F7Label', 'div', 'app-label')
export const F7Note = passthroughComponent('F7Note', 'span', 'app-note')
export const F7Text = passthroughComponent('F7Text', 'span', 'app-text')
export const F7Grid = passthroughComponent('F7Grid', 'div', 'grid app-grid')
export const F7Row = passthroughComponent('F7Row', 'div', 'row app-row')
export const F7Col = passthroughComponent('F7Col', 'div', 'col app-col')
export const F7Avatar = passthroughComponent('F7Avatar', 'div', 'app-avatar')

export const F7List = f7List
export const F7ListInput = f7ListInput
export const F7Link = f7Link
export const F7ToolbarPane = f7ToolbarPane
export const F7Block = f7Block
export const F7BlockTitle = f7BlockTitle
export const F7Actions = f7Actions
export const F7ActionsButton = f7ActionsButton
export const F7ActionsGroup = f7ActionsGroup
export const F7ActionsLabel = f7ActionsLabel
export const F7Navbar = defineComponent({
  name: 'F7Navbar',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const navbarRef = ref<ComponentPublicInstance | HTMLElement>()

    function resizeNavbar() {
      const element = navbarRef.value instanceof HTMLElement
        ? navbarRef.value
        : navbarRef.value?.$el
      if (element)
        f7?.navbar.size(element)
    }

    onMounted(() => {
      void nextTick(resizeNavbar)
    })

    watch(
      () => [attrs.title, attrs.titleLarge, attrs.large],
      () => void nextTick(resizeNavbar),
    )

    return () => h(f7Navbar, mergeProps(attrs, { ref: navbarRef }), slots)
  },
})
export const F7PageContent = f7PageContent
export const F7Spinner = f7Preloader
export const F7Searchbar = f7Searchbar
export const F7SkeletonText = f7SkeletonText
export const F7Chip = f7Chip

export const F7Content = defineComponent({
  name: 'F7Content',
  inheritAttrs: false,
  setup(_, { attrs, expose, slots }) {
    const embedded = inject(pageSurfaceContextKey, undefined) === 'embedded'
    const element = ref<HTMLElement>()
    const setElement = (instance: Element | ComponentPublicInstance | null) => {
      element.value = (instance instanceof Element ? instance : instance?.$el) as HTMLElement | undefined
    }
    const getScrollElement = async () => element.value as HTMLElement
    const scrollToTop = async (duration = 0) => {
      element.value?.scrollTo({ top: 0, behavior: duration > 0 ? 'smooth' : 'auto' })
    }
    const scrollToPoint = async (_x: number, y: number, duration = 0) => {
      element.value?.scrollTo({ top: y, behavior: duration > 0 ? 'smooth' : 'auto' })
    }
    expose({ getScrollElement, scrollToPoint, scrollToTop })

    return () => {
      const nextAttrs = { ...attrs }
      delete nextAttrs.fullscreen
      delete nextAttrs.forceOverscroll
      if (embedded) {
        return h('div', mergeProps(nextAttrs, {
          ref: setElement,
          class: ['app-pane-content', 'app-content', attrs.class],
        }), slots.default?.())
      }
      return h(f7PageContent, mergeProps(nextAttrs, {
        ref: setElement,
        class: ['app-content', attrs.class],
      }), slots)
    }
  },
})

export const F7Button = defineComponent({
  name: 'F7Button',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => {
      const nextAttrs = { ...attrs }
      const routerLink = nextAttrs.routerLink as string | undefined
      delete nextAttrs.routerLink
      delete nextAttrs.routerDirection
      delete nextAttrs.size
      return h(f7Button, mergeProps(nextAttrs, {
        href: routerLink || nextAttrs.href || false,
        type: routerLink ? undefined : attrs.type || 'button',
        small: attrs.size === 'small',
        fill: attrs.fill === true || attrs.fill === 'solid',
        class: ['app-button', attrs.class],
      }), slots)
    }
  },
})

export const F7BackButton = defineComponent({
  name: 'F7BackButton',
  inheritAttrs: false,
  props: {
    text: String,
    defaultHref: String,
    deterministic: Boolean,
  },
  setup(props, { attrs }) {
    const router = useFramework7AppRouter()
    const handleClick = (event: MouseEvent) => {
      if (!props.deterministic)
        return

      event.preventDefault()
      event.stopPropagation()
      void router.backTo(props.defaultHref || '/home')
    }

    return () => h(f7Link, mergeProps(attrs, {
      'href': props.deterministic ? false : props.defaultHref || '/home',
      'back': !props.deterministic,
      'icon': 'icon-back',
      'iconOnly': true,
      'class': ['app-back-button', attrs.class],
      'aria-label': attrs['aria-label'] || props.text || '返回',
      'onClick': handleClick,
    }))
  },
})

export const F7Icon = defineComponent({
  name: 'F7Icon',
  inheritAttrs: false,
  props: {
    icon: [Object, Function, String] as PropType<Component | string>,
    size: String,
  },
  setup(props, { attrs, slots }) {
    return () => {
      if (typeof props.icon === 'object' || typeof props.icon === 'function') {
        return h(props.icon as Component, mergeProps(attrs, {
          class: ['app-icon', attrs.class],
          size: props.size,
        }))
      }
      return h('span', mergeProps(attrs, { class: ['app-icon', attrs.class] }), slots.default?.() || props.icon || '')
    }
  },
})

export const F7Image = defineComponent({
  name: 'F7Image',
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () => h('img', mergeProps(attrs, { class: ['app-image', attrs.class] }))
  },
})

export const F7Item = defineComponent({
  name: 'f7-list-item-adapter',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => {
      const nextAttrs = { ...attrs }
      const detail = nextAttrs.detail
      delete nextAttrs.button
      delete nextAttrs.detail
      delete nextAttrs.lines
      return h(f7ListItem, mergeProps(nextAttrs, {
        noChevron: detail === false,
        class: ['app-list-item', attrs.class],
      }), {
        'media': slots.media || slots.start,
        'header': slots.header,
        'before-title': slots['before-title'],
        'title': slots.title || slots.default,
        'subtitle': slots.subtitle,
        'text': slots.text,
        'footer': slots.footer,
        'after': slots.after || slots.end,
      })
    }
  },
})

function createFieldComponent(name: string, type?: 'textarea') {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      modelValue: [String, Number],
      label: String,
    },
    emits: ['update:modelValue', 'f7-input', 'f7-focus', 'f7-change'],
    setup(props, { attrs, emit, expose }) {
      const component = ref<ComponentPublicInstance>()
      const getElement = () => {
        const root = component.value?.$el as HTMLElement | undefined
        return root?.matches('input, textarea')
          ? root as HTMLInputElement | HTMLTextAreaElement
          : root?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
      }
      const setFocus = () => getElement()?.focus()
      const getInputElement = async () => getElement()
      expose({ getInputElement, setFocus })

      const field = () => {
        const nextAttrs = { ...attrs }
        const autoGrow = nextAttrs.autoGrow ?? nextAttrs['auto-grow']
        delete nextAttrs.autoGrow
        delete nextAttrs['auto-grow']
        if (typeof nextAttrs.spellcheck === 'boolean')
          nextAttrs.spellcheck = String(nextAttrs.spellcheck)
        return h(f7Input, mergeProps(nextAttrs, {
          ref: component,
          type: type || attrs.type,
          wrap: false,
          resizable: type === 'textarea' && autoGrow !== false && autoGrow !== undefined,
          class: ['app-field__control', attrs.class],
          value: props.modelValue ?? '',
          onInput: (event: Event) => {
            const value = (event.target as HTMLInputElement).value
            emit('update:modelValue', value)
            emit('f7-input', new CustomEvent('f7-input', { detail: { value } }))
          },
          onChange: (event: Event) => emit('f7-change', new CustomEvent('f7-change', {
            detail: { value: (event.target as HTMLInputElement).value },
          })),
          onFocus: (event: FocusEvent) => emit('f7-focus', event),
        }))
      }

      return () => props.label
        ? h('label', { class: 'app-field' }, [h('span', { class: 'app-field__label' }, props.label), field()])
        : field()
    },
  })
}

export const F7Input = createFieldComponent('F7Input')
export const F7Textarea = createFieldComponent('F7Textarea', 'textarea')
export type F7TextareaElement = HTMLTextAreaElement & {
  getInputElement: () => Promise<HTMLTextAreaElement | undefined>
  setFocus: () => void
}

export const F7Toggle = defineComponent({
  name: 'F7Toggle',
  inheritAttrs: false,
  props: {
    checked: Boolean,
    disabled: Boolean,
  },
  emits: ['f7-change', 'update:checked'],
  setup(props, { attrs, emit }) {
    return () => h(f7Toggle, mergeProps(attrs, {
      checked: props.checked,
      disabled: props.disabled,
      onChange: (event: Event) => {
        const checked = (event.target as HTMLInputElement).checked
        emit('update:checked', checked)
        emit('f7-change', new CustomEvent('f7-change', { detail: { checked } }))
      },
    }))
  },
})

export const F7Modal = defineComponent({
  name: 'F7Modal',
  inheritAttrs: false,
  props: {
    isOpen: Boolean,
    backdrop: {
      type: Boolean,
      default: true,
    },
    canDismiss: {
      type: [Boolean, Function] as PropType<boolean | ((data?: unknown, role?: string) => boolean | Promise<boolean>)>,
      default: undefined,
    },
    breakpoints: Array as PropType<number[]>,
    initialBreakpoint: Number,
    keepMounted: Boolean,
    push: Boolean,
  },
  emits: ['did-dismiss', 'will-present', 'update:isOpen'],
  setup(props, { attrs, emit, expose, slots }) {
    const opened = ref(false)
    const shellMounted = ref(props.keepMounted)
    const contentMounted = ref(props.isOpen)
    let presented = false
    let openSequence = 0
    let dismissDetail: { data?: unknown, role?: string } | undefined
    const setElement = (instance: Element | ComponentPublicInstance | null) => {
      const element = instance instanceof Element ? instance : instance?.$el as HTMLElement | undefined
      if (element)
        Object.assign(element, { dismiss })
    }
    watch(() => props.isOpen, async (value) => {
      const sequence = ++openSequence
      if (value) {
        shellMounted.value = true
        contentMounted.value = true
        dismissDetail = undefined
        emit('will-present')
        await nextTick()
        if (sequence !== openSequence || !props.isOpen)
          return
        presented = true
        opened.value = true
        return
      }

      opened.value = value
      if (!presented && !props.keepMounted) {
        contentMounted.value = false
        shellMounted.value = false
      }
    }, { immediate: true })

    async function dismiss(data?: unknown, role?: string) {
      if (typeof props.canDismiss === 'function' && !await props.canDismiss(data, role))
        return false
      dismissDetail = { data, role }
      opened.value = false
      emit('update:isOpen', false)
      return true
    }

    expose({ dismiss })

    return () => {
      if (!shellMounted.value)
        return null

      const nextAttrs = { ...attrs }
      delete nextAttrs['focus-trap']
      delete nextAttrs.focusTrap
      delete nextAttrs['presenting-element']
      delete nextAttrs.presentingElement
      const breakpoints = props.breakpoints
        ?.filter(value => value > 0 && value < 1)
        .toSorted((a, b) => a - b)

      return h(f7Sheet, mergeProps(nextAttrs, {
        'ref': setElement,
        'opened': opened.value,
        'class': ['app-modal', attrs.class],
        'backdrop': props.backdrop,
        'push': props.push,
        'closeByBackdropClick': props.backdrop
          && props.canDismiss !== false
          && typeof props.canDismiss !== 'function',
        'closeOnEscape': props.canDismiss !== false && typeof props.canDismiss !== 'function',
        'swipeToClose': props.canDismiss !== false && typeof props.canDismiss !== 'function',
        'swipeHandler': '.app-sheet-handle',
        breakpoints,
        'onSheet:open': (sheet: { setBreakpoint?: (value: number) => void }) => {
          const initialBreakpoint = props.initialBreakpoint
          if (initialBreakpoint && breakpoints?.includes(initialBreakpoint))
            sheet.setBreakpoint?.(initialBreakpoint)
        },
        'onUpdate:opened': (value: boolean) => {
          if (opened.value === value)
            return
          opened.value = value
          emit('update:isOpen', value)
        },
        'onSheet:closed': () => {
          const detail = dismissDetail || {}
          dismissDetail = undefined
          emit('did-dismiss', new CustomEvent('did-dismiss', { detail }))
          presented = false
          contentMounted.value = false
          if (!props.keepMounted)
            shellMounted.value = false
        },
      }), {
        default: () => contentMounted.value
          ? [
              h('div', { 'class': 'app-sheet-handle', 'aria-hidden': 'true' }),
              slots.default?.(),
            ]
          : undefined,
        fixed: () => contentMounted.value ? slots.fixed?.() : undefined,
      })
    }
  },
})

export const F7Popover = defineComponent({
  name: 'F7Popover',
  inheritAttrs: false,
  props: {
    isOpen: Boolean,
    targetEl: [String, Object],
  },
  emits: ['did-dismiss', 'update:isOpen'],
  setup(props, { attrs, emit, slots }) {
    return () => h(f7Popover, mergeProps(attrs, {
      'opened': props.isOpen,
      'targetEl': props.targetEl,
      'backdrop': true,
      'closeByBackdropClick': true,
      'closeByOutsideClick': true,
      'closeOnEscape': true,
      'class': ['app-popover', attrs.class],
      'onUpdate:opened': (opened: boolean) => emit('update:isOpen', opened),
      'onPopover:closed': () => emit('did-dismiss'),
    }), slots)
  },
})

interface AccordionContext {
  expanded: Ref<string[]>
  setOpened: (id: string, opened: boolean) => void
}
const accordionKey: InjectionKey<AccordionContext> = Symbol('f7-accordion')

export const F7AccordionGroup = defineComponent({
  name: 'F7AccordionGroup',
  props: {
    value: [String, Array] as PropType<string | string[]>,
    multiple: Boolean,
  },
  emits: ['f7-change'],
  setup(props, { emit, slots }) {
    const expanded = ref<string[]>([])
    watch(() => props.value, value => expanded.value = Array.isArray(value) ? value : value ? [value] : [], { immediate: true })
    const setOpened = (id: string, opened: boolean) => {
      const next = opened
        ? props.multiple ? [...new Set([...expanded.value, id])] : [id]
        : expanded.value.filter(value => value !== id)
      if (next.length === expanded.value.length && next.every((value, index) => value === expanded.value[index]))
        return
      expanded.value = next
      emit('f7-change', new CustomEvent('f7-change', { detail: { value: expanded.value } }))
    }
    provide(accordionKey, { expanded, setOpened })
    return () => h(Fragment, slots.default?.())
  },
})

export const F7Accordion = defineComponent({
  name: 'f7-list-item-accordion-adapter',
  props: {
    value: { type: String, required: true },
    expandable: { type: Boolean, default: true },
  },
  emits: ['leaf-click'],
  setup(props, { attrs, emit, slots }) {
    const group = inject(accordionKey)
    const open = computed(() => group?.expanded.value.includes(props.value) ?? false)
    const element = ref<HTMLElement>()
    let allowToggle = false
    const setElement = (instance: Element | ComponentPublicInstance | null) => {
      element.value = (instance instanceof Element ? instance : instance?.$el) as HTMLElement | undefined
    }
    const guardToggle = (prevent: () => void) => {
      if (!allowToggle)
        prevent()
      allowToggle = false
    }
    const toggleFromControl = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (!props.expandable) {
        emit('leaf-click')
        return
      }
      allowToggle = true
      if (element.value && f7?.accordion) {
        f7.accordion.toggle(element.value)
        return
      }
      group?.setOpened(props.value, !open.value)
    }
    const onToggleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ')
        return
      event.preventDefault()
      ;(event.currentTarget as HTMLElement).click()
    }
    return () => h(f7ListItem, mergeProps(attrs, {
      'accordionItem': true,
      'accordionItemOpened': open.value,
      'class': ['app-list-item', 'app-accordion', attrs.class],
      'ref': setElement,
      'onAccordion:beforeopen': guardToggle,
      'onAccordion:beforeclose': guardToggle,
      'onAccordion:open': () => group?.setOpened(props.value, true),
      'onAccordion:close': () => group?.setOpened(props.value, false),
      'onAccordion:opened': () => group?.setOpened(props.value, true),
      'onAccordion:closed': () => group?.setOpened(props.value, false),
    }), {
      media: slots.media,
      title: slots.title || slots.header,
      after: () => [
        slots.after?.(),
        h('span', {
          'class': 'folder-accordion-toggle',
          'role': 'button',
          'tabindex': 0,
          'aria-label': props.expandable
            ? open.value ? '收起文件夹' : '展开文件夹'
            : '打开文件夹',
          'onClick': toggleFromControl,
          'onKeydown': onToggleKeydown,
        }),
      ],
      default: () => h(f7AccordionContent, null, slots.content),
    })
  },
})

function usePageLifecycle(eventName: 'pageBeforeIn' | 'pageAfterIn' | 'pageBeforeOut' | 'pageAfterOut', callback: () => void | Promise<void>) {
  const instance = getCurrentInstance()
  let mountedElement: Element | null = null
  const handler = (page: { el?: Element }) => {
    if (!mountedElement || !page.el || (page.el !== mountedElement && !page.el.contains(mountedElement)))
      return
    void callback()
  }
  onMounted(() => {
    mountedElement = instance?.proxy?.$el as Element | null
    f7?.on(eventName, handler)
  })
  onBeforeUnmount(() => f7?.off(eventName, handler))
}

export const onF7ViewWillEnter = (callback: () => void | Promise<void>) => usePageLifecycle('pageBeforeIn', callback)
export const onF7ViewDidEnter = (callback: () => void | Promise<void>) => usePageLifecycle('pageAfterIn', callback)
export const onF7ViewWillLeave = (callback: () => void | Promise<void>) => usePageLifecycle('pageBeforeOut', callback)
export const onF7ViewDidLeave = (callback: () => void | Promise<void>) => usePageLifecycle('pageAfterOut', callback)

export function isPlatform(platform: string) {
  if (platform === 'ios')
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (platform === 'android')
    return /Android/.test(navigator.userAgent)
  return false
}

function waitForF7(): Promise<any> {
  if (f7)
    return Promise.resolve(f7)
  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      if (!f7)
        return
      window.clearInterval(timer)
      resolve(f7 as any)
    }, 10)
  })
}

function normalizeButton(button: OverlayButton) {
  return typeof button === 'string' ? { text: button } : button
}

export const dialogController = {
  async prompt(params: { text: string, title?: string, defaultValue?: string }) {
    const app = await waitForF7()
    return new Promise<string | null>((resolve) => {
      let settled = false
      const settle = (value: string | null) => {
        if (settled)
          return
        settled = true
        resolve(value)
      }
      const dialog = app.dialog.prompt(
        params.text,
        params.title,
        (value: string) => settle(value),
        () => settle(null),
        params.defaultValue,
      )
      dialog.once('closed', () => settle(null))
    })
  },
  async create(params: AnyRecord) {
    const app = await waitForF7()
    const dismissHandlers: Array<() => void> = []
    const inputs = (params.inputs ?? []) as AnyRecord[]
    const inputHtml = inputs.map((input, index) => `<input class="dialog-input" data-dialog-input="${index}" name="${input.name ?? `input${index}`}" placeholder="${input.placeholder ?? ''}" value="${input.value ?? ''}">`).join('')
    const buttons = (params.buttons ?? ['确定']).map(normalizeButton).map((button: AnyRecord) => ({
      text: button.text,
      cssClass: button.cssClass,
      close: button.role !== 'cancel' || params.backdropDismiss !== false,
      onClick(instance: AnyRecord) {
        const values: AnyRecord = {}
        inputs.forEach((input, index) => {
          values[input.name ?? `input${index}`] = instance.el?.querySelector(`[data-dialog-input="${index}"]`)?.value ?? ''
        })
        button.handler?.(values)
      },
    }))
    const instance = app.dialog.create({
      title: params.header,
      text: params.message,
      content: inputHtml,
      buttons,
      closeByBackdropClick: params.backdropDismiss !== false,
      on: { closed: () => dismissHandlers.splice(0).forEach(handler => handler()) },
    })
    return {
      instance,
      present: async () => instance.open(),
      dismiss: async () => instance.close(),
      onDismiss: (handler: () => void) => dismissHandlers.push(handler),
    }
  },
}

export const alertController = dialogController

export const F7Alert = defineComponent({
  name: 'F7Alert',
  props: {
    isOpen: Boolean,
    header: String,
    message: String,
    buttons: Array as PropType<OverlayButton[]>,
    inputs: Array as PropType<AnyRecord[]>,
  },
  emits: ['did-present', 'did-dismiss'],
  setup(props, { emit }) {
    let dialog: AnyRecord | undefined
    watch(() => props.isOpen, async (isOpen) => {
      if (!isOpen) {
        dialog?.close?.()
        return
      }
      const overlay = await dialogController.create(props)
      dialog = overlay.instance
      await overlay.present()
      emit('did-present')
      overlay.onDismiss(() => emit('did-dismiss'))
    }, { immediate: true })
    return () => null
  },
})

export const toastController = {
  async create(params: AnyRecord) {
    const app = await waitForF7()
    const instance = app.toast.create({
      text: params.message,
      position: params.position === 'top' ? 'top' : 'bottom',
      closeTimeout: params.duration ?? 2000,
    })
    return { present: async () => instance.open(), dismiss: async () => instance.close() }
  },
  async dismiss(..._args: unknown[]) {
    const app = await waitForF7()
    app.toast.close('.toast')
  },
}

export const loadingController = {
  async create(params: AnyRecord) {
    const app = await waitForF7()
    let instance: AnyRecord
    return {
      present: async () => {
        instance = app.dialog.preloader(params.message)
      },
      dismiss: async () => instance?.close?.(),
    }
  },
}

export type F7ModalElement = HTMLElement & { dismiss: (data?: unknown, role?: string) => Promise<boolean> }
export type F7LoadingElement = Awaited<ReturnType<typeof loadingController.create>>
