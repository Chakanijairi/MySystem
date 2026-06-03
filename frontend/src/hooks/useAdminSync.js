import { useEffect } from 'react'

/** Re-run callback when admin local data changes (same tab or other tab). */
export function useAdminSync(onTick) {
  useEffect(() => {
    function handle() {
      onTick()
    }
    window.addEventListener('pc-admin-updates', handle)
    window.addEventListener('storage', handle)
    return () => {
      window.removeEventListener('pc-admin-updates', handle)
      window.removeEventListener('storage', handle)
    }
  }, [onTick])
}
