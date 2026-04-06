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
  const res = await fetch(`/api${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 502) {
      throw new Error(
        'Cannot reach the API (502). Start the backend: cd backend && npm run dev — or run npm run dev from the project root. If the API crashes, fix DATABASE_URL in backend/.env'
      )
    }
    throw new Error(data.error || res.statusText || 'Request failed')
  }
  return data
}

export async function openAdminDocument(id) {
  const res = await fetch(`/api/admin/documents/${id}/file`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error('Could not open document')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
