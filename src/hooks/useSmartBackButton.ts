import type { RouteLocationNormalized } from 'vue-router'
import { isPlatform } from '@ionic/vue'
import { computed } from 'vue'
import { useNavigationHistory } from './useNavigationHistory'

// 笔记详情页返回按钮
export function useNoteBackButton(
  route: RouteLocationNormalized,
  data: { value?: { parent_id?: string } },
  username?: string,
) {
  const { getSmartBackPath } = useNavigationHistory()

  const fallbackPath = computed(() => {
    if (username)
      return `/${username}`
    if (data.value?.parent_id)
      return `/f/${data.value.parent_id}`
    return '/home'
  })

  return {
    backButtonProps: computed(() => ({
      text: '返回',
      defaultHref: getSmartBackPath(route, fallbackPath.value),
    })),
  }
}

// 文件夹页返回按钮
export function useFolderBackButton(
  route: RouteLocationNormalized,
  isTopFolder: () => boolean,
  username?: string,
) {
  const { getSmartBackPath } = useNavigationHistory()

  const fallbackPath = computed(() => {
    if (username && isTopFolder())
      return `/${username}`
    if (isTopFolder())
      return '/home'

    const path = route.path
    const lastSegment = path.split('/').pop()
    return path.replace(`/${lastSegment}`, '')
  })

  return {
    backButtonProps: computed(() => ({
      text: '返回',
      defaultHref: getSmartBackPath(route, fallbackPath.value),
    })),
  }
}

// 简单固定返回按钮
export function useSimpleBackButton(defaultHref: string, text = '返回') {
  return {
    backButtonProps: computed(() => ({
      text: isPlatform('ios') ? text : '',
      defaultHref,
    })),
  }
}
