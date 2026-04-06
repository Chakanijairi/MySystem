/** Production: set VITE_API_URL in Vercel to your Render API origin (no trailing slash), e.g. https://xxx.onrender.com */
function apiBase() {
  const raw = import.meta.env.VITE_API_URL
  if (typeof raw === 'string' && raw.trim()) {
    return raw.replace(/\/$/, '')
  }
  return ''
}

/** Full URL for fetch (e.g. FormData uploads). Path like `/me/documents`. */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${apiBase()}/api${p}`
}

export function getToken() {
  return localStorage.getItem('token')
}

export function setToken(t) {
  if (t) localStorage.setItem('token', t)
  else localStorage.removeItem('token')
}

export async function api(path, options = {}) {
  const headers = { ...options.headers }
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  const t = getToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  const base = apiBase()
  const url = `${base}/api${path}`
  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 502) {
      throw new Error(
        'Cannot reach the API (502). For production, set VITE_API_URL on Vercel to your Render backend URL.'
      )
    }
    throw new Error(data.error || res.statusText || 'Request failed')
  }
  return data
}

export async function openAdminDocument(id) {
  const base = apiBase()
  const res = await fetch(`${base}/api/admin/documents/${id}/file`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error('Could not open document')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
