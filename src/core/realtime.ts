import type { RealtimeConfig, RealtimeEvent } from '@/shared/lib/realtime'
import { PocketBaseRealtimeService } from '@/shared/api/pocketbase'
import { RealtimeStatus } from '@/shared/lib/realtime'

export type { RealtimeConfig, RealtimeEvent }

export type LegacyRealtimeStatus = `${RealtimeStatus}`
export type RealtimeStatusValue = LegacyRealtimeStatus

export class PocketBaseRealtime extends PocketBaseRealtimeService {}

export function createPocketBaseRealtime(config?: RealtimeConfig): PocketBaseRealtime {
  return new PocketBaseRealtime(config)
}

let realtimeInstance: PocketBaseRealtime | null = null

export function getRealtimeInstance(): PocketBaseRealtime {
  if (!realtimeInstance) {
    realtimeInstance = new PocketBaseRealtime()
  }
  return realtimeInstance
}

export function resetRealtimeInstance(): void {
  if (realtimeInstance) {
    realtimeInstance.disconnect()
    realtimeInstance = null
  }
}

export { RealtimeStatus }
