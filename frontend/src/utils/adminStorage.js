/**
 * Admin data layer.
 *
 * Roles, permissions, audit log, promotions, and system settings now live in
 * PostgreSQL behind /api/admin/*. This module keeps the existing synchronous
 * `loadX()` / `appendX()` interface that the admin pages already use, but
 * is backed by the API:
 *
 *   - `loadX()` returns a cached snapshot immediately and kicks off a
 *     background fetch the first time it is called. When the fetch resolves,
 *     it updates the cache and dispatches `pc-admin-updates` so any subscribed
 *     component re-renders with the fresh data.
 *   - mutations (`saveX`, `appendX`, role CRUD) are optimistic — they update
 *     the in-memory cache + localStorage immediately, then sync with the API.
 *
 * Orders / MVD / system identity defaults still live client-side as before;
 * they are not yet wired to the backend.
 */
import {
  archiveExpiredPromotionsApi,
  bulkDeletePromotions,
  createPromotion,
  createRole,
  deletePromotion,
  deleteRoleApi,
  fetchAudit,
  fetchPromotions,
  fetchRoles,
  fetchSettings,
  patchSettings,
  postAuditEvent,
  updatePromotion,
  updateRoleApi,
} from '../api/admin'

const KEY_ACTIVITY = 'pc_admin_activity_v2'
const KEY_PROMOTIONS = 'pc_admin_promotions_v3'
const KEY_SETTINGS = 'pc_admin_settings_v2'
const KEY_ORDERS = 'pc_admin_orders_v4'
const KEY_MVD = 'pc_admin_mvd_v3'
const LEGACY_SALES_KEYS = ['pc_admin_orders_v3', 'pc_admin_mvd_v2']

/** Old demo dealers — if still present, replace with current Pagadian seed data. */
const LEGACY_SALES_DEALERS = new Set([
  'Maria Santos',
  'Raniel Nayno',
  'Jose Reyes',
  'Lalla Estuderra',
  'Laila Estudantes',
])
const KEY_SYSTEM_IDENTITY = 'pc_admin_system_identity_v1'
const KEY_ROLES = 'pc_admin_roles_v1'

const ADMIN_KEYS = [
  KEY_ACTIVITY,
  KEY_PROMOTIONS,
  KEY_SETTINGS,
  KEY_ORDERS,
  KEY_MVD,
  KEY_SYSTEM_IDENTITY,
  KEY_ROLES,
]

/**
 * Recruiter override: every recruiter automatically earns this share of MVD
 * points based on the total sales of everyone they recruited.
 */
export const MVD_RATE = 0.1

export function computeRecruiterMvd(rows, dealerName, month, year) {
  if (!dealerName) return 0
  const total = (rows || [])
    .filter(
      (r) =>
        r.recruiter === dealerName &&
        Number(r.month) === Number(month) &&
        Number(r.year) === Number(year)
    )
    .reduce((sum, r) => sum + Number(r.sales || 0), 0)
  return Math.round(total * MVD_RATE)
}

export function computeMvdBreakdown(rows, dealerName, month, year) {
  if (!dealerName) return []
  return (rows || [])
    .filter(
      (r) =>
        r.recruiter === dealerName &&
        Number(r.month) === Number(month) &&
        Number(r.year) === Number(year)
    )
    .map((r) => ({
      dealer: r.dealer,
      role: r.role,
      sales: Number(r.sales || 0),
      contribution: Math.round(Number(r.sales || 0) * MVD_RATE),
    }))
    .sort((a, b) => b.contribution - a.contribution)
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function notifyAdminUpdate() {
  window.dispatchEvent(new CustomEvent('pc-admin-updates'))
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage quota or disabled; fail soft.
  }
}

/* ============================================================
 *  Activity / Audit log
 * ============================================================ */

let cachedActivity = null
let activityFetchStarted = false

function normalizeAuditEvent(e) {
  return {
    id: e.id || uid(),
    at: e.at || e.created_at || new Date().toISOString(),
    type: e.type || 'general',
    action: e.action || '',
    detail: e.detail || '',
    user: e.user || e.user_label || 'Admin',
    userRole: e.userRole || e.user_role || 'admin',
    ip: e.ip || 'local',
  }
}

async function refreshActivity() {
  try {
    const data = await fetchAudit({ limit: 300 })
    cachedActivity = (data.events || []).map(normalizeAuditEvent)
    saveJson(KEY_ACTIVITY, cachedActivity)
    notifyAdminUpdate()
  } catch {
    // keep local cache
  }
}

function ensureActivityLoaded() {
  if (activityFetchStarted) return
  activityFetchStarted = true
  refreshActivity()
}

export function loadActivity() {
  if (cachedActivity == null) {
    const stored = loadJson(KEY_ACTIVITY, [])
    cachedActivity = Array.isArray(stored)
      ? stored.map(normalizeAuditEvent)
      : []
  }
  ensureActivityLoaded()
  return cachedActivity
}

export function saveActivity(rows) {
  const list = Array.isArray(rows) ? rows.map(normalizeAuditEvent) : []
  cachedActivity = list
  saveJson(KEY_ACTIVITY, list)
  notifyAdminUpdate()
}

export function appendActivity({ type, action, detail, user, userRole, ip }) {
  const optimistic = normalizeAuditEvent({
    id: `temp_${uid()}`,
    at: new Date().toISOString(),
    type: type || 'general',
    action: action || '',
    detail: detail || '',
    user: user || undefined,
    userRole: userRole || undefined,
    ip: ip || 'local',
  })
  cachedActivity = [optimistic, ...(cachedActivity || []).slice(0, 499)]
  saveJson(KEY_ACTIVITY, cachedActivity)
  notifyAdminUpdate()

  postAuditEvent({ type, action, detail })
    .then(() => refreshActivity())
    .catch(() => {
      // server unreachable — local entry stays
    })
}

/* ============================================================
 *  Promotions / bulletins
 * ============================================================ */

let cachedPromotions = null
let promotionsFetchStarted = false

function normalizePromotion(p) {
  return {
    id: p.id,
    title: p.title || '',
    type: p.type || 'promotion',
    message: p.message || '',
    startDate: p.startDate || p.start_date || '',
    endDate: p.endDate || p.end_date || '',
    visibility: p.visibility || 'all',
    bannerDataUrl: p.bannerDataUrl ?? p.banner_data_url ?? '',
    percentOff:
      p.percentOff ?? p.percent_off ?? null,
    published: p.published == null ? true : !!p.published,
    archived: !!p.archived,
    manualStatus: p.manualStatus ?? p.manual_status ?? null,
    views: Number(p.views || 0),
    salesLinked: Number(p.salesLinked ?? p.sales_linked ?? 0),
    createdBy: p.createdBy ?? p.created_by_name ?? 'Admin',
    createdAt: p.createdAt || p.created_at || new Date().toISOString(),
    updatedAt: p.updatedAt || p.updated_at || new Date().toISOString(),
  }
}

async function refreshPromotions() {
  try {
    const list = await fetchPromotions(true)
    cachedPromotions = list.map(normalizePromotion)
    saveJson(KEY_PROMOTIONS, cachedPromotions)
    notifyAdminUpdate()
  } catch {
    // keep local cache
  }
}

function ensurePromotionsLoaded() {
  if (promotionsFetchStarted) return
  promotionsFetchStarted = true
  refreshPromotions()
}

export function loadPromotions() {
  if (cachedPromotions == null) {
    const stored = loadJson(KEY_PROMOTIONS, [])
    cachedPromotions = Array.isArray(stored)
      ? stored.map(normalizePromotion)
      : []
  }
  ensurePromotionsLoaded()
  return cachedPromotions
}

/**
 * Diff-based save: figures out create/update/delete vs the current cache and
 * issues the appropriate API calls. Optimistic local update happens first.
 */
export function savePromotions(list) {
  const previous = cachedPromotions || []
  const next = Array.isArray(list) ? list.map(normalizePromotion) : []
  cachedPromotions = next
  saveJson(KEY_PROMOTIONS, next)
  notifyAdminUpdate()

  ;(async () => {
    try {
      const prevById = new Map(previous.map((p) => [p.id, p]))
      const nextById = new Map(next.map((p) => [p.id, p]))

      // Deletes
      for (const [id] of prevById) {
        if (!nextById.has(id) && !String(id).startsWith('temp_')) {
          try {
            await deletePromotion(id)
          } catch {}
        }
      }

      // Creates and updates
      for (const p of next) {
        const isNew = !prevById.has(p.id) || String(p.id).startsWith('temp_')
        const payload = {
          title: p.title,
          type: p.type,
          message: p.message,
          startDate: p.startDate || null,
          endDate: p.endDate || null,
          visibility: p.visibility,
          bannerDataUrl: p.bannerDataUrl || null,
          percentOff: p.percentOff,
          published: p.published,
          archived: p.archived,
          manualStatus: p.manualStatus,
          views: p.views,
          salesLinked: p.salesLinked,
        }
        try {
          if (isNew) {
            await createPromotion(payload)
          } else {
            await updatePromotion(p.id, payload)
          }
        } catch {}
      }
      await refreshPromotions()
    } catch {
      // server unreachable
    }
  })()
}

export function archiveExpiredPromotions() {
  let count = 0
  const now = new Date()
  const next = (cachedPromotions || []).map((r) => {
    const end = r.endDate ? new Date(r.endDate) : null
    if (end && now > end && !r.archived) {
      count += 1
      return {
        ...r,
        archived: true,
        manualStatus: 'expired',
        published: false,
        updatedAt: new Date().toISOString(),
      }
    }
    return r
  })
  cachedPromotions = next
  saveJson(KEY_PROMOTIONS, next)
  notifyAdminUpdate()
  archiveExpiredPromotionsApi()
    .then(() => refreshPromotions())
    .catch(() => {})
  return count
}

export function bulkDeletePromotionsApi(ids) {
  const remaining = (cachedPromotions || []).filter(
    (p) => !ids.includes(p.id)
  )
  cachedPromotions = remaining
  saveJson(KEY_PROMOTIONS, remaining)
  notifyAdminUpdate()
  return bulkDeletePromotions(ids)
    .then(() => refreshPromotions())
    .catch(() => {})
}

/* ============================================================
 *  System settings + identity
 * ============================================================ */

const PREF_DEFAULTS = {
  requireDocumentVerification: true,
  memberSelfRegistration: false,
  emailAlertsForAdmins: true,
  maintenanceMode: false,
  showInventoryAges: true,
  requireStrongPasswords: false,
  autoLogoutInactivity: true,
  loginActivityAlerts: false,
  twoFactorAuth: false,
  notifyNewMember: true,
  notifyNewSale: false,
  notifyAccountStatus: true,
  notifyWeeklySummary: false,
  notifyBulletinPublished: true,
  showNotificationBell: true,
  showRecentActivityFeed: true,
}

const IDENTITY_DEFAULTS = {
  systemName: 'Personal Collection',
  adminEmail: 'admin@personalcollection.ph',
  contactNumber: '',
  defaultPassword: '123',
  brandColor: '#CC0000',
  logoDataUrl: '',
  faviconDataUrl: '',
}

let cachedSettings = null
let settingsFetchStarted = false

function settingsToPrefs(flat) {
  const out = { ...PREF_DEFAULTS }
  for (const [key, value] of Object.entries(flat || {})) {
    if (key.startsWith('pref.')) {
      out[key.slice('pref.'.length)] = value
    }
  }
  return out
}

function settingsToIdentity(flat) {
  const out = { ...IDENTITY_DEFAULTS }
  for (const [key, value] of Object.entries(flat || {})) {
    if (key.startsWith('identity.')) {
      out[key.slice('identity.'.length)] = value
    }
  }
  return out
}

async function refreshSettings() {
  try {
    const flat = await fetchSettings()
    cachedSettings = flat || {}
    saveJson(KEY_SETTINGS, cachedSettings)
    saveJson(KEY_SYSTEM_IDENTITY, settingsToIdentity(cachedSettings))
    notifyAdminUpdate()
  } catch {
    // keep local cache
  }
}

function ensureSettingsLoaded() {
  if (settingsFetchStarted) return
  settingsFetchStarted = true
  refreshSettings()
}

export function loadSettings() {
  if (cachedSettings == null) {
    cachedSettings = loadJson(KEY_SETTINGS, {}) || {}
  }
  ensureSettingsLoaded()
  return settingsToPrefs(cachedSettings)
}

export function loadSystemIdentity() {
  if (cachedSettings == null) {
    cachedSettings = loadJson(KEY_SETTINGS, {}) || {}
  }
  ensureSettingsLoaded()
  return settingsToIdentity(cachedSettings)
}

function applySettingsPatch(prefix, patch) {
  const flat = { ...(cachedSettings || {}) }
  const apiPatch = {}
  for (const [k, v] of Object.entries(patch || {})) {
    const key = `${prefix}.${k}`
    flat[key] = v
    apiPatch[key] = v
  }
  cachedSettings = flat
  saveJson(KEY_SETTINGS, flat)
  if (prefix === 'identity') {
    saveJson(KEY_SYSTEM_IDENTITY, settingsToIdentity(flat))
  }
  notifyAdminUpdate()
  patchSettings(apiPatch)
    .then((merged) => {
      cachedSettings = merged
      saveJson(KEY_SETTINGS, merged)
      saveJson(KEY_SYSTEM_IDENTITY, settingsToIdentity(merged))
      notifyAdminUpdate()
    })
    .catch(() => {})
}

export function saveSettings(patch) {
  applySettingsPatch('pref', patch)
}

export function saveSystemIdentity(patch) {
  applySettingsPatch('identity', patch)
}

/* ============================================================
 *  Roles & permissions
 * ============================================================ */

export const ROLE_FEATURES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'viewMembers', label: 'View All Members' },
  { key: 'registerMembers', label: 'Register Members' },
  { key: 'editMembers', label: 'Edit Members' },
  { key: 'activate', label: 'Activate / Deactivate' },
  { key: 'viewSales', label: 'View All Sales' },
  { key: 'recordSale', label: 'Record Sale' },
  { key: 'managePromotions', label: 'Manage Promotions' },
  { key: 'systemSettings', label: 'System Settings' },
]

export const ROLE_COLORS = [
  { id: 'rose', label: 'Red', pill: 'bg-rose-100 text-rose-800', text: 'text-rose-700' },
  { id: 'sky', label: 'Blue', pill: 'bg-sky-100 text-sky-800', text: 'text-sky-700' },
  { id: 'amber', label: 'Amber', pill: 'bg-amber-100 text-amber-800', text: 'text-amber-700' },
  { id: 'violet', label: 'Violet', pill: 'bg-violet-100 text-violet-800', text: 'text-violet-700' },
  { id: 'emerald', label: 'Green', pill: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-700' },
  { id: 'slate', label: 'Slate', pill: 'bg-slate-100 text-slate-800', text: 'text-slate-700' },
]

export const ACCESS_LEVELS = ['Full Access', 'Senior', 'Elevated', 'Standard', 'Limited']

let cachedRoles = null
let rolesFetchStarted = false

function normalizeRoleApiRow(r) {
  const seedDefaults = Object.fromEntries(ROLE_FEATURES.map((f) => [f.key, 'none']))
  return {
    id: r.id,
    name: r.name,
    display_name: r.display_name || r.name,
    access_level: r.access_level || 'Standard',
    color: r.color || 'slate',
    description: r.description || '',
    builtin: !!r.builtin,
    member_count: r.member_count != null ? Number(r.member_count) : null,
    permissions: { ...seedDefaults, ...(r.permissions || {}) },
  }
}

async function refreshRoles() {
  try {
    const list = await fetchRoles()
    cachedRoles = list.map(normalizeRoleApiRow)
    saveJson(KEY_ROLES, cachedRoles)
    notifyAdminUpdate()
  } catch {
    // keep local cache
  }
}

function ensureRolesLoaded() {
  if (rolesFetchStarted) return
  rolesFetchStarted = true
  refreshRoles()
}

export function loadRoles() {
  if (cachedRoles == null) {
    const stored = loadJson(KEY_ROLES, [])
    cachedRoles = Array.isArray(stored)
      ? stored.map(normalizeRoleApiRow)
      : []
  }
  ensureRolesLoaded()
  return cachedRoles
}

export async function addCustomRole(input) {
  const created = await createRole({
    display_name: input.display_name || input.name || '',
    name: input.name || input.display_name || '',
    access_level: input.access_level || input.access || 'Standard',
    color: input.color || 'slate',
    description: input.description || '',
    permissions: input.permissions || {},
  })
  await refreshRoles()
  return normalizeRoleApiRow(created)
}

export async function updateRole(id, patch) {
  const updated = await updateRoleApi(id, {
    display_name: patch.display_name ?? patch.name,
    access_level: patch.access_level ?? patch.access,
    color: patch.color,
    description: patch.description,
    permissions: patch.permissions,
  })
  await refreshRoles()
  return normalizeRoleApiRow(updated)
}

export async function deleteRole(id) {
  await deleteRoleApi(id)
  await refreshRoles()
}

/* ============================================================
 *  Orders / MVD (still localStorage-only)
 * ============================================================ */

const SEED_ORDERS = [
  {
    id: 'ORD-0038',
    dealer: 'Chawkani Jairi',
    address: 'Purok Manga Kawit Pagadian City',
    amount: 3200,
    role: 'manager',
    date: '2026-05-07',
    dueDate: '2026-05-07',
    status: 'paid',
    quantity: 2,
    notes: 'Payment received via GCash.',
    items: [
      { name: 'PC Body Lotion 250ml', variant: 'Skincare · White/Pink', sku: 'PC-BL-250', price: 1200, qty: 1 },
      { name: 'PC Lip Color Set – Rose', variant: 'Cosmetics · Rose Shade', sku: 'PC-LC-RS', price: 1000, qty: 2 },
    ],
    activity: [
      { at: '2026-05-07T15:15:00', by: 'Chawkani Jairi', action: 'Order marked as Paid', kind: 'paid' },
      { at: '2026-05-07T15:00:00', by: 'Chawkani Jairi', action: 'Sale recorded', kind: 'recorded' },
    ],
  },
  {
    id: 'ORD-0037',
    dealer: 'Raniel Cabayaran',
    address: 'Zone 3 Tiguma Pagadian City',
    amount: 4400,
    role: 'member',
    date: '2026-05-06',
    dueDate: '2026-05-06',
    status: 'paid',
    quantity: 4,
    notes: 'Bulk order delivered within Pagadian City.',
    items: [
      { name: 'PC Soap Bundle (4 pcs)', variant: 'Skincare · Bundle', sku: 'PC-SB-04', price: 1100, qty: 4 },
    ],
    activity: [
      { at: '2026-05-06T16:00:00', by: 'Raniel Cabayaran', action: 'Order marked as Paid', kind: 'paid' },
      { at: '2026-05-06T14:00:00', by: 'Raniel Cabayaran', action: 'Sale recorded', kind: 'recorded' },
    ],
  },
  {
    id: 'ORD-0036',
    dealer: 'Amel Hansol',
    address: 'Labangan Lantian Pagadian City',
    amount: 1800,
    role: 'member',
    date: '2026-05-05',
    dueDate: '2026-05-05',
    status: 'pending',
    quantity: 1,
    notes: 'Awaiting payment confirmation.',
    items: [
      { name: 'PC Body Wash 200ml', variant: 'Skincare · Citrus', sku: 'PC-BW-200', price: 1800, qty: 1 },
    ],
    activity: [
      { at: '2026-05-05T10:30:00', by: 'Amel Hansol', action: 'Sale recorded', kind: 'recorded' },
    ],
  },
  {
    id: 'ORD-0035',
    dealer: 'Laila Edullantes',
    address: 'Poruk Sandayong St.Nino Pagadian City',
    amount: 800,
    role: 'member',
    date: '2026-05-04',
    dueDate: '2026-05-04',
    status: 'paid',
    quantity: 1,
    notes: 'Pickup at branch.',
    items: [
      { name: 'PC Perfume 30ml', variant: 'Fragrance · Floral', sku: 'PC-PF-030', price: 800, qty: 1 },
    ],
    activity: [
      { at: '2026-05-04T11:00:00', by: 'Laila Edullantes', action: 'Sale recorded', kind: 'recorded' },
    ],
  },
]

function dropLegacySalesKeys() {
  LEGACY_SALES_KEYS.forEach((k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  })
}

function salesRowsNeedReseed(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false
  return rows.some((r) => LEGACY_SALES_DEALERS.has(r.dealer))
}

function cloneSeedOrders() {
  return JSON.parse(JSON.stringify(SEED_ORDERS))
}

function cloneSeedMvd() {
  return JSON.parse(JSON.stringify(SEED_MVD))
}

export function loadOrders() {
  dropLegacySalesKeys()
  let rows = loadJson(KEY_ORDERS, null)
  if (!rows || !Array.isArray(rows) || salesRowsNeedReseed(rows)) {
    rows = cloneSeedOrders()
    saveJson(KEY_ORDERS, rows)
    notifyAdminUpdate()
  }
  return rows
}

export function saveOrders(rows) {
  saveJson(KEY_ORDERS, rows)
  notifyAdminUpdate()
}

const SEED_MVD = [
  {
    id: 'mvd_1',
    dealer: 'Chawkani Jairi',
    role: 'manager',
    address: 'Purok Manga Kawit Pagadian City',
    recruiter: null,
    sales: 3200,
    orders: 2,
    month: 5,
    year: 2026,
    date: '2026-05-07',
  },
  {
    id: 'mvd_2',
    dealer: 'Raniel Cabayaran',
    role: 'member',
    address: 'Zone 3 Tiguma Pagadian City',
    recruiter: 'Chawkani Jairi',
    sales: 4400,
    orders: 4,
    month: 5,
    year: 2026,
    date: '2026-05-06',
  },
  {
    id: 'mvd_3',
    dealer: 'Amel Hansol',
    role: 'member',
    address: 'Labangan Lantian Pagadian City',
    recruiter: 'Chawkani Jairi',
    sales: 1800,
    orders: 1,
    month: 5,
    year: 2026,
    date: '2026-05-05',
  },
  {
    id: 'mvd_4',
    dealer: 'Laila Edullantes',
    role: 'member',
    address: 'Poruk Sandayong St.Nino Pagadian City',
    recruiter: 'Chawkani Jairi',
    sales: 800,
    orders: 1,
    month: 5,
    year: 2026,
    date: '2026-05-04',
  },
]

export function loadMvd() {
  dropLegacySalesKeys()
  let rows = loadJson(KEY_MVD, null)
  if (!rows || !Array.isArray(rows) || salesRowsNeedReseed(rows)) {
    rows = cloneSeedMvd()
    saveJson(KEY_MVD, rows)
    notifyAdminUpdate()
  }
  return rows
}

export function saveMvd(rows) {
  saveJson(KEY_MVD, rows)
  notifyAdminUpdate()
}

/* ============================================================
 *  Danger zone helpers
 * ============================================================ */

export function wipeSalesRecords() {
  dropLegacySalesKeys()
  saveJson(KEY_ORDERS, cloneSeedOrders())
  saveJson(KEY_MVD, cloneSeedMvd())
  notifyAdminUpdate()
}

export function purgeInactiveMembersDemo() {
  return { cleared: 0 }
}

/**
 * Clears the local cache and localStorage so the next render fetches fresh
 * data from the API. Does NOT touch the database — to wipe roles / promotions /
 * settings from the server, call the corresponding admin endpoints.
 */
export function factoryReset() {
  ADMIN_KEYS.forEach((k) => localStorage.removeItem(k))
  dropLegacySalesKeys()
  cachedActivity = null
  activityFetchStarted = false
  cachedPromotions = null
  promotionsFetchStarted = false
  cachedSettings = null
  settingsFetchStarted = false
  cachedRoles = null
  rolesFetchStarted = false
  notifyAdminUpdate()
}
