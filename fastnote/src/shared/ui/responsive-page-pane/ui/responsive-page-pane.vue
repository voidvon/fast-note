<script lang="ts">
import { defineComponent, Fragment, h } from 'vue'

export default defineComponent({
  name: 'ResponsivePagePane',
  inheritAttrs: false,
  props: {
    desktop: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { attrs, slots }) {
    return () => {
      const children = slots.default?.()

      return props.desktop
        ? h('div', attrs, children)
        : h(Fragment, null, children)
    }
  },
})
</script>
