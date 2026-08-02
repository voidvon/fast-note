import type { AppRouteLocation } from '@/shared/lib/framework7'
import { computed } from 'vue'
import { isPlatform } from '@/shared/ui/f7'
import { useNavigationHistory } from './use-navigation-history'

export function useNoteBackButton(
  route: AppRouteLocation,
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

export function useFolderBackButton(
  route: AppRouteLocation,
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

export function useSimpleBackButton(defaultHref: string, text = '返回') {
  return {
    backButtonProps: computed(() => ({
      text: isPlatform('ios') ? text : '',
      defaultHref,
    })),
  }
}
