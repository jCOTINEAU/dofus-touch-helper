/** Notification de mise à jour du service worker (vite-plugin-pwa, mode prompt). */

import { registerSW } from 'virtual:pwa-register'

let needRefresh = $state(false)

const update = registerSW({
  immediate: true,
  onNeedRefresh: () => {
    needRefresh = true
  },
})

export const swUpdate = {
  get needRefresh() {
    return needRefresh
  },
  reload() {
    void update(true)
  },
  dismiss() {
    needRefresh = false
  },
}
