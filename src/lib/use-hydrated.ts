import { useSyncExternalStore } from 'react'

const subscribeNothing = () => () => {}

/**
 * `false` ở server và ở lần render hydrate, `true` ngay sau khi React hydrate xong (render lại đồng bộ), không lệch markup.
 * Component mount sau đó (điều hướng phía client) nhận `true` ngay từ lần render đầu, không nháy.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  )
}
