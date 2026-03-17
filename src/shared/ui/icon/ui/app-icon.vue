<template>
  <svg :class="{ [`icon-color-${$attrs.color}`]: $attrs.color }" class="icon-component icon" aria-hidden="true">
    <use :xlink:href="`#icon-${$attrs.name}`" />
  </svg>
</template>

<style lang="scss">
.icon-component {
  &.icon-color-danger {
    color: var(--danger);
  }
}
</style>
