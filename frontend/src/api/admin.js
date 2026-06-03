import { api } from './client'

/* Roles & permissions */

export function fetchRoles() {
  return api('/admin/roles').then((d) => d.roles || [])
}

export function createRole(payload) {
  return api('/admin/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((d) => d.role)
}

export function updateRoleApi(id, patch) {
  return api(`/admin/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((d) => d.role)
}

export function deleteRoleApi(id) {
  return api(`/admin/roles/${id}`, { method: 'DELETE' })
}

/* Audit log */

export function fetchAudit(params = {}) {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.type) qs.set('type', params.type)
  if (params.action) qs.set('action', params.action)
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.page) qs.set('page', String(params.page))
  const suffix = qs.toString()
  return api(`/admin/audit${suffix ? `?${suffix}` : ''}`)
}

export function postAuditEvent(event) {
  return api('/admin/audit', {
    method: 'POST',
    body: JSON.stringify(event),
  }).then((d) => d.event)
}

/* Promotions */

export function fetchPromotions(includeArchived = true) {
  return api(
    `/admin/promotions?includeArchived=${includeArchived ? 'true' : 'false'}`
  ).then((d) => d.promotions || [])
}

export function fetchPromotion(id) {
  return api(`/admin/promotions/${id}`).then((d) => d.promotion)
}

export function createPromotion(payload) {
  return api('/admin/promotions', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((d) => d.promotion)
}

export function updatePromotion(id, patch) {
  return api(`/admin/promotions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((d) => d.promotion)
}

export function deletePromotion(id) {
  return api(`/admin/promotions/${id}`, { method: 'DELETE' })
}

export function bulkDeletePromotions(ids) {
  return api('/admin/promotions/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function archiveExpiredPromotionsApi() {
  return api('/admin/promotions/archive-expired', { method: 'POST' })
}

/* System settings */

export function fetchSettings() {
  return api('/admin/settings').then((d) => d.settings || {})
}

export function patchSettings(patch) {
  return api('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((d) => d.settings || {})
}
