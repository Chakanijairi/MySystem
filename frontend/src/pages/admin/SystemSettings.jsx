import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ACCESS_LEVELS,
  ROLE_COLORS,
  ROLE_FEATURES,
  addCustomRole,
  appendActivity,
  archiveExpiredPromotions,
  deleteRole,
  factoryReset,
  loadActivity,
  loadRoles,
  loadSettings,
  loadSystemIdentity,
  purgeInactiveMembersDemo,
  saveSettings,
  saveSystemIdentity,
  updateRole,
  wipeSalesRecords,
} from '../../utils/adminStorage'
import { useAdminSync } from '../../hooks/useAdminSync'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'roles', label: 'Roles' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'danger', label: 'Danger Zone' },
]

const inputCls =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#D10000] focus:outline-none focus:ring-1 focus:ring-[#D10000]'

function SectionHeader({ children }) {
  return (
    <div className="bg-[#D10000] px-4 py-2.5 text-sm font-bold text-white">
      {children}
    </div>
  )
}

function FieldLabel({ children }) {
  return <span className="mb-1 block text-xs font-medium text-neutral-700">{children}</span>
}

export default function SystemSettings() {
  const [tab, setTab] = useState('general')
  const [identity, setIdentity] = useState(() => loadSystemIdentity())
  const [settings, setSettings] = useState(() => loadSettings())
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  const sync = () => {
    setIdentity(loadSystemIdentity())
    setSettings(loadSettings())
  }
  useAdminSync(sync)

  function patchIdentity(key, value) {
    setIdentity((p) => ({ ...p, [key]: value }))
    setDirty(true)
  }

  function patchSettings(key, value) {
    setSettings((p) => ({ ...p, [key]: value }))
    setDirty(true)
  }

  function saveAll() {
    saveSystemIdentity(identity)
    saveSettings(settings)
    appendActivity({
      type: 'system',
      action: 'System settings saved',
      detail: `Tab: ${tab}`,
    })
    setDirty(false)
    setSavedAt(new Date())
    window.setTimeout(() => setSavedAt(null), 3000)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-neutral-900">System Settings</h2>
        <div className="flex items-center gap-3">
          {savedAt ? (
            <span className="text-xs text-emerald-700">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          ) : null}
          <button
            type="button"
            onClick={saveAll}
            disabled={!dirty}
            className="rounded-md bg-[#D10000] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#b30000] disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <nav className="flex flex-wrap gap-6 text-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative -mb-px border-b-2 pb-2.5 pt-1 font-medium transition-colors ${
                tab === t.id
                  ? 'border-[#D10000] text-[#D10000]'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'general' ? (
        <GeneralTab identity={identity} patch={patchIdentity} />
      ) : null}
      {tab === 'security' ? (
        <SecurityTab settings={settings} patch={patchSettings} />
      ) : null}
      {tab === 'roles' ? <RolesTab /> : null}
      {tab === 'notifications' ? (
        <NotificationsTab settings={settings} patch={patchSettings} />
      ) : null}
      {tab === 'audit' ? <AuditTab /> : null}
      {tab === 'danger' ? <DangerTab /> : null}
    </div>
  )
}

/* ─── General tab ─── */

function GeneralTab({ identity, patch }) {
  return (
    <div className="space-y-5">
      {/* System Identity */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <SectionHeader>System Identity</SectionHeader>
        <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2">
          <label className="block">
            <FieldLabel>System Name</FieldLabel>
            <input
              value={identity.systemName}
              onChange={(e) => patch('systemName', e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <FieldLabel>Admin Email Address</FieldLabel>
            <input
              type="email"
              value={identity.adminEmail}
              onChange={(e) => patch('adminEmail', e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <FieldLabel>Contact Number</FieldLabel>
            <input
              value={identity.contactNumber}
              onChange={(e) => patch('contactNumber', e.target.value)}
              placeholder="(08)XXXXXXXX"
              className={inputCls}
            />
          </label>
          <label className="block">
            <FieldLabel>Default Password for New Members</FieldLabel>
            <input
              value={identity.defaultPassword}
              onChange={(e) => patch('defaultPassword', e.target.value)}
              className={inputCls}
            />
            <p className="mt-1 text-xs font-medium text-emerald-600">
              New members log in with this password.
            </p>
          </label>
        </div>
      </div>

      {/* Branding */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <SectionHeader>Branding</SectionHeader>
        <div className="grid grid-cols-1 gap-4 px-5 py-5 lg:grid-cols-3">
          <UploadField
            label="System Logo"
            hint="PNG, SVG · Recommended 1024px"
            dataUrl={identity.logoDataUrl}
            onChange={(url) => patch('logoDataUrl', url)}
            accept="image/png,image/svg+xml,image/jpeg"
          />
          <UploadField
            label="Favicon"
            hint="ICO, PNG · 32-256px"
            dataUrl={identity.faviconDataUrl}
            onChange={(url) => patch('faviconDataUrl', url)}
            accept="image/png,image/x-icon,image/svg+xml"
          />
          <div>
            <FieldLabel>Brand Color</FieldLabel>
            <div className="flex items-center gap-3">
              <label className="relative h-11 w-16 shrink-0 cursor-pointer overflow-hidden rounded-md border border-neutral-300 shadow-sm">
                <input
                  type="color"
                  value={identity.brandColor}
                  onChange={(e) => patch('brandColor', e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span
                  className="block h-full w-full"
                  style={{ background: identity.brandColor }}
                  aria-hidden
                />
              </label>
              <input
                value={identity.brandColor}
                onChange={(e) => patch('brandColor', e.target.value)}
                className={inputCls}
                placeholder="#CC0000"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function UploadField({ label, hint, dataUrl, onChange, accept }) {
  const inputRef = useRef(null)

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-28 w-full flex-col items-center justify-center rounded-md border-2 border-dashed border-neutral-300 bg-neutral-50/60 px-3 text-center transition-colors hover:border-[#D10000] hover:bg-rose-50"
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`${label} preview`}
            className="max-h-20 max-w-full object-contain"
          />
        ) : (
          <>
            <span className="text-xs font-medium text-neutral-600">Click to upload {label.toLowerCase()}</span>
            <span className="mt-1 text-[11px] text-neutral-500">{hint}</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {dataUrl ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="mt-2 text-xs font-medium text-[#D10000] hover:underline"
        >
          Remove
        </button>
      ) : null}
    </div>
  )
}

/* ─── Security tab ─── */

function SecurityTab({ settings, patch }) {
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' })

  function updatePassword() {
    if (!curPwd || !newPwd) {
      setPwdMsg({ type: 'error', text: 'Enter both current and new password.' })
      return
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'New password and confirmation do not match.' })
      return
    }
    if (settings.requireStrongPasswords && (newPwd.length < 8 || !/[A-Z]/.test(newPwd) || !/[0-9]/.test(newPwd))) {
      setPwdMsg({
        type: 'error',
        text: 'Strong-password policy requires min. 8 characters, 1 uppercase, 1 number.',
      })
      return
    }
    appendActivity({
      type: 'system',
      action: 'Admin password changed',
      detail: 'Password updated via Security settings',
    })
    setPwdMsg({ type: 'ok', text: 'Password update recorded. (Backend integration pending.)' })
    setCurPwd('')
    setNewPwd('')
    setConfirmPwd('')
    window.setTimeout(() => setPwdMsg({ type: '', text: '' }), 4000)
  }

  const items = [
    {
      key: 'requireStrongPasswords',
      label: 'Require Strong Passwords',
      description: 'Enforce min. 8 characters, 1 uppercase, 1 number for all accounts.',
    },
    {
      key: 'autoLogoutInactivity',
      label: 'Auto-Logout After Inactivity',
      description: 'Log out sessions idle for more than 30 minutes.',
    },
    {
      key: 'loginActivityAlerts',
      label: 'Login Activity Alerts',
      description: 'Notify admin when a new device logs in.',
    },
    {
      key: 'twoFactorAuth',
      label: 'Two-Factor Authentication',
      description: 'Require OTP verification on login for admin accounts.',
    },
  ]

  return (
    <div className="space-y-5">
      {/* Change Admin Password */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <SectionHeader>
          <span className="mr-1">🔒</span> Change Admin Password
        </SectionHeader>
        <div className="px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PasswordField
              label="Current Password *"
              value={curPwd}
              onChange={setCurPwd}
              show={showCur}
              toggleShow={() => setShowCur((s) => !s)}
            />
            <PasswordField
              label="New Password *"
              value={newPwd}
              onChange={setNewPwd}
              show={showNew}
              toggleShow={() => setShowNew((s) => !s)}
            />
            <PasswordField
              label="Confirm New Password *"
              value={confirmPwd}
              onChange={setConfirmPwd}
              show={showConfirm}
              toggleShow={() => setShowConfirm((s) => !s)}
            />
          </div>
          {pwdMsg.text ? (
            <p
              className={`mt-3 text-xs ${
                pwdMsg.type === 'error' ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {pwdMsg.text}
            </p>
          ) : null}
          <button
            type="button"
            onClick={updatePassword}
            className="mt-4 rounded-md bg-[#D10000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b30000]"
          >
            Update Password
          </button>
        </div>
      </div>

      {/* Security Preferences */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <SectionHeader>
          <span className="mr-1">🛡</span> Security Preferences
        </SectionHeader>
        <div className="divide-y divide-neutral-100">
          {items.map((it) => (
            <ToggleRow
              key={it.key}
              label={it.label}
              description={it.description}
              value={!!settings[it.key]}
              onChange={(v) => patch(it.key, v)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function PasswordField({ label, value, onChange, show, toggleShow }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} pr-10`}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 hover:bg-neutral-100"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </label>
  )
}

function ToggleRow({ label, description, value, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 px-5 py-4">
      <div>
        <p className="text-sm font-semibold text-neutral-900">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-neutral-600">{description}</p>
        ) : null}
      </div>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300 accent-[#D10000]"
      />
    </label>
  )
}

/* ─── Roles tab ─── */

function permMode(value) {
  if (value === 'full') return 'full'
  if (typeof value === 'string' && value.startsWith('partial:')) return 'partial'
  return 'none'
}

function permNote(value) {
  if (typeof value === 'string' && value.startsWith('partial:')) {
    return value.slice('partial:'.length).trim()
  }
  return ''
}

function colorPreset(id) {
  return ROLE_COLORS.find((c) => c.id === id) || ROLE_COLORS[ROLE_COLORS.length - 1]
}

function RolesTab() {
  const [roles, setRoles] = useState(() => loadRoles())
  const [modal, setModal] = useState(null) // { mode: 'view' | 'edit' | 'create', role? }
  const [feedback, setFeedback] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)

  const refresh = () => setRoles(loadRoles())
  useAdminSync(refresh)

  function flash(type, text) {
    setFeedback({ type, text })
    window.setTimeout(() => setFeedback({ type: '', text: '' }), 3000)
  }

  async function handleSave(form) {
    if (busy) return
    setBusy(true)
    try {
      if (modal.mode === 'create') {
        const r = await addCustomRole(form)
        appendActivity({
          type: 'system',
          action: 'Custom role created',
          detail: `${r.display_name} (${r.access_level})`,
        })
        flash('ok', `Role "${r.display_name}" created.`)
      } else if (modal.mode === 'edit') {
        const r = await updateRole(modal.role.id, form)
        appendActivity({
          type: 'system',
          action: 'Role updated',
          detail: `${r.display_name} permissions updated`,
        })
        flash('ok', `Role "${r.display_name}" updated.`)
      }
      refresh()
      setModal(null)
    } catch (err) {
      flash('error', err.message || 'Could not save role')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(role) {
    if (
      !window.confirm(
        `Delete custom role "${role.display_name}"? Members assigned to it will need to be reassigned.`
      )
    )
      return
    if (busy) return
    setBusy(true)
    try {
      await deleteRole(role.id)
      appendActivity({
        type: 'system',
        action: 'Custom role deleted',
        detail: role.display_name,
      })
      flash('ok', `Role "${role.display_name}" deleted.`)
      refresh()
    } catch (err) {
      flash('error', err.message || 'Could not delete role')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {feedback.text ? (
        <div
          className={`rounded-md border px-4 py-2 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {/* Role Management */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between bg-[#D10000] px-4 py-2.5">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-white">
            <span aria-hidden>👥</span> Role Management
          </h3>
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="rounded-md bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30 hover:bg-white/25"
          >
            + Add Custom Role
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Access Level</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const preset = colorPreset(r.color)
                const isAdminRole = r.name === 'admin'
                return (
                  <tr key={r.id} className="border-b border-neutral-100">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${preset.pill}`}
                      >
                        {r.display_name}
                      </span>
                      {!r.builtin ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                          custom
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-semibold text-neutral-900">{r.access_level}</td>
                    <td className="px-4 py-3 text-neutral-800 tabular-nums">
                      {r.member_count == null ? '—' : r.member_count}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{r.description || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {!isAdminRole ? (
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'edit', role: r })}
                            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            Edit
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'view', role: r })}
                          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          View
                        </button>
                        {!r.builtin ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            disabled={busy}
                            className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission Matrix (dynamic) */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <SectionHeader>
          <span className="mr-1">🧩</span> Permission Matrix
        </SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-3">Feature</th>
                {roles.map((r) => {
                  const preset = colorPreset(r.color)
                  return (
                    <th
                      key={r.id}
                      className={`px-4 py-3 text-center ${preset.text}`}
                    >
                      {r.display_name}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {ROLE_FEATURES.map((f) => (
                <tr key={f.key} className="border-b border-neutral-100">
                  <td className="px-4 py-3 text-neutral-800">{f.label}</td>
                  {roles.map((r) => (
                    <td key={r.id} className="px-4 py-3 text-center">
                      <PermCell value={r.permissions?.[f.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal ? (
        <RoleModal
          mode={modal.mode}
          role={modal.role}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      ) : null}
    </div>
  )
}

function PermCell({ value }) {
  const mode = permMode(value)
  if (mode === 'full') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#D10000] text-[10px] font-bold text-white">
        ✓
      </span>
    )
  }
  if (mode === 'partial') {
    const note = permNote(value)
    return (
      <span className="text-xs italic text-neutral-500">
        {note || 'Limited'}
      </span>
    )
  }
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-neutral-300 bg-neutral-100 text-[10px] text-neutral-400">
      —
    </span>
  )
}

function RoleModal({ mode, role, onClose, onSave }) {
  const isView = mode === 'view'
  const isCreate = mode === 'create'
  const isEdit = mode === 'edit'

  const initial = role || {
    display_name: '',
    access_level: 'Standard',
    color: 'slate',
    description: '',
    permissions: {},
    builtin: false,
  }

  const [form, setForm] = useState(() => ({
    display_name: initial.display_name || initial.name || '',
    access_level: initial.access_level || 'Standard',
    color: initial.color || 'slate',
    description: initial.description || '',
    permissions: Object.fromEntries(
      ROLE_FEATURES.map((f) => [f.key, initial.permissions?.[f.key] || 'none'])
    ),
  }))
  const [partialNotes, setPartialNotes] = useState(() => {
    const out = {}
    ROLE_FEATURES.forEach((f) => {
      const v = initial.permissions?.[f.key]
      if (typeof v === 'string' && v.startsWith('partial:')) {
        out[f.key] = v.slice('partial:'.length)
      }
    })
    return out
  })
  const [error, setError] = useState('')

  function setPerm(key, nextMode) {
    if (nextMode === 'full' || nextMode === 'none') {
      setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: nextMode } }))
      return
    }
    const note = partialNotes[key] || ''
    setForm((f) => ({
      ...f,
      permissions: { ...f.permissions, [key]: `partial:${note}` },
    }))
  }

  function setNote(key, note) {
    setPartialNotes((p) => ({ ...p, [key]: note }))
    setForm((f) => ({
      ...f,
      permissions: { ...f.permissions, [key]: `partial:${note}` },
    }))
  }

  function submit(e) {
    e?.preventDefault()
    if (isView) return
    setError('')
    if (!form.display_name.trim()) {
      setError('Role name is required.')
      return
    }
    onSave(form)
  }

  const lockedName = isView || (isEdit && role?.builtin)
  const title = isCreate
    ? 'Create Custom Role'
    : isView
    ? `View Role — ${form.display_name}`
    : `Edit Role — ${form.display_name}`

  return (
    <ModalShell title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <FieldLabel>Role Name *</FieldLabel>
            <input
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Branch Auditor"
              disabled={lockedName}
            />
            {isEdit && role?.builtin ? (
              <p className="mt-1 text-[11px] text-neutral-500">
                Built-in role names are locked.
              </p>
            ) : null}
          </label>

          <label className="block">
            <FieldLabel>Access Level</FieldLabel>
            <select
              value={form.access_level}
              onChange={(e) => setForm((f) => ({ ...f, access_level: e.target.value }))}
              disabled={isView}
              className={inputCls}
            >
              {ACCESS_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <FieldLabel>Badge Color</FieldLabel>
            <select
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              disabled={isView}
              className={inputCls}
            >
              {ROLE_COLORS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                colorPreset(form.color).pill
              }`}
            >
              {form.name || 'Preview'}
            </span>
          </label>

          <label className="block">
            <FieldLabel>Description</FieldLabel>
            <input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              disabled={isView}
              placeholder="Short summary shown on the role list"
              className={inputCls}
            />
          </label>
        </div>

        <div>
          <FieldLabel>Permissions</FieldLabel>
          <div className="overflow-hidden rounded-md border border-neutral-200">
            <div className="grid grid-cols-12 bg-neutral-50/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
              <div className="col-span-5">Feature</div>
              <div className="col-span-4">Access</div>
              <div className="col-span-3">Note (when limited)</div>
            </div>
            {ROLE_FEATURES.map((f) => {
              const value = form.permissions[f.key] || 'none'
              const mode = permMode(value)
              return (
                <div
                  key={f.key}
                  className="grid grid-cols-12 items-center gap-2 border-t border-neutral-100 px-3 py-2"
                >
                  <div className="col-span-5 text-sm text-neutral-800">{f.label}</div>
                  <div className="col-span-4">
                    <fieldset className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5" disabled={isView}>
                      <PermPill
                        active={mode === 'full'}
                        label="Allow"
                        flavor="full"
                        onClick={() => setPerm(f.key, 'full')}
                      />
                      <PermPill
                        active={mode === 'partial'}
                        label="Limited"
                        flavor="partial"
                        onClick={() => setPerm(f.key, 'partial')}
                      />
                      <PermPill
                        active={mode === 'none'}
                        label="Deny"
                        flavor="none"
                        onClick={() => setPerm(f.key, 'none')}
                      />
                    </fieldset>
                  </div>
                  <div className="col-span-3">
                    {mode === 'partial' ? (
                      <input
                        value={partialNotes[f.key] || ''}
                        onChange={(e) => setNote(f.key, e.target.value)}
                        disabled={isView}
                        placeholder="Own only"
                        className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
                      />
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {error ? (
          <p className="text-xs font-medium text-rose-700">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            {isView ? 'Close' : 'Cancel'}
          </button>
          {!isView ? (
            <button
              type="submit"
              className="rounded-md bg-[#D10000] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#b30000]"
            >
              {isCreate ? 'Create Role' : 'Save Changes'}
            </button>
          ) : null}
        </div>
      </form>
    </ModalShell>
  )
}

function PermPill({ active, label, flavor, onClick }) {
  const inactive =
    'text-neutral-600 hover:bg-neutral-100'
  const activeCls =
    flavor === 'full'
      ? 'bg-emerald-600 text-white'
      : flavor === 'partial'
      ? 'bg-amber-500 text-white'
      : 'bg-neutral-700 text-white'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
        active ? activeCls : inactive
      }`}
    >
      {label}
    </button>
  )
}

function ModalShell({ title, children, onClose }) {
  useEffect(() => {
    function onEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onEsc)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

/* ─── Notifications tab ─── */

function NotificationsTab({ settings, patch }) {
  const email = [
    {
      key: 'notifyNewMember',
      icon: '👤',
      label: 'New Member Registration',
      description: 'Alert when a new member is registered.',
    },
    {
      key: 'notifyNewSale',
      icon: '💲',
      label: 'New Sales Record',
      description: 'Email for every new sale entered.',
    },
    {
      key: 'notifyAccountStatus',
      icon: '✅',
      label: 'Account Status Change',
      description: 'Alert on activation or deactivation of any account.',
    },
    {
      key: 'notifyWeeklySummary',
      icon: '🗓',
      label: 'Weekly Summary Report',
      description: 'Receive a digest every Monday recounting members and sales.',
    },
    {
      key: 'notifyBulletinPublished',
      icon: '📣',
      label: 'Bulletin Published',
      description: 'Alert when a new promotion or bulletin is published.',
    },
  ]
  const inSystem = [
    {
      key: 'showNotificationBell',
      icon: '🔔',
      label: 'Show Notification Bell',
      description: 'Display unread notification count in the header.',
    },
    {
      key: 'showRecentActivityFeed',
      icon: '📰',
      label: 'Recent Activity Feed',
      description: 'Show recent activity on the dashboard.',
    },
  ]
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <SectionHeader>
          <span className="mr-1">✉️</span> Email Notifications
        </SectionHeader>
        <div className="divide-y divide-neutral-100">
          {email.map((it) => (
            <SwitchRow
              key={it.key}
              icon={it.icon}
              label={it.label}
              description={it.description}
              value={!!settings[it.key]}
              onChange={(v) => patch(it.key, v)}
            />
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <SectionHeader>
          <span className="mr-1">🔔</span> In-System Notifications
        </SectionHeader>
        <div className="divide-y divide-neutral-100">
          {inSystem.map((it) => (
            <SwitchRow
              key={it.key}
              icon={it.icon}
              label={it.label}
              description={it.description}
              value={!!settings[it.key]}
              onChange={(v) => patch(it.key, v)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SwitchRow({ icon, label, description, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-rose-50 text-base text-[#D10000]"
        >
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-900">{label}</p>
          <p className="mt-0.5 text-xs text-neutral-600">{description}</p>
        </div>
      </div>
      <Switch value={value} onChange={onChange} />
    </div>
  )
}

function Switch({ value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        value ? 'bg-[#D10000]' : 'bg-neutral-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

/* ─── Audit Log tab ─── */

const PAGE_SIZE_AUDIT = 5

function AuditTab() {
  const [rows, setRows] = useState(() => loadActivity())
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    function refresh() {
      setRows(loadActivity())
    }
    window.addEventListener('pc-admin-updates', refresh)
    return () => window.removeEventListener('pc-admin-updates', refresh)
  }, [])

  const actionOptions = useMemo(() => {
    const set = new Set()
    rows.forEach((r) => r.action && set.add(r.action))
    return ['all', ...Array.from(set)]
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (actionFilter !== 'all' && r.action !== actionFilter) return false
      if (q.trim()) {
        const t = q.trim().toLowerCase()
        const hay = `${r.user || ''} ${r.action || ''} ${r.detail || ''}`.toLowerCase()
        if (!hay.includes(t)) return false
      }
      if (from) {
        const f = new Date(from)
        if (new Date(r.at) < f) return false
      }
      if (to) {
        const t2 = new Date(to)
        t2.setHours(23, 59, 59, 999)
        if (new Date(r.at) > t2) return false
      }
      return true
    })
  }, [rows, q, from, to, actionFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_AUDIT))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE_AUDIT, safePage * PAGE_SIZE_AUDIT)

  function exportCsv() {
    const headers = ['Date & Time', 'User', 'Action', 'Details', 'IP Address']
    const lines = [headers.join(',')]
    filtered.forEach((r) => {
      const cells = [
        new Date(r.at).toLocaleString(),
        r.user || '',
        r.action || '',
        (r.detail || '').replace(/"/g, '""'),
        r.ip || '',
      ].map((c) => `"${c}"`)
      lines.push(cells.join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    appendActivity({
      type: 'system',
      action: 'Audit log exported',
      detail: `${filtered.length} entries exported`,
    })
  }

  function actionDot(action) {
    const a = (action || '').toLowerCase()
    if (a.includes('deactiv') || a.includes('purge') || a.includes('delete')) return 'bg-red-500'
    if (a.includes('sale')) return 'bg-emerald-500'
    if (a.includes('registered') || a.includes('member')) return 'bg-sky-500'
    if (a.includes('login')) return 'bg-violet-500'
    return 'bg-amber-500'
  }

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#D10000] px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-white">
          <span aria-hidden>📋</span> Audit Log
        </h3>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30 hover:bg-white/25"
        >
          <span aria-hidden>⬇</span> Export Log
        </button>
      </div>

      <div className="border-b border-neutral-100 px-4 py-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">🔍</span>
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
                placeholder="Search by user or action..."
                className={`${inputCls} pl-8`}
              />
            </div>
          </div>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
            className={`${inputCls} md:col-span-2`}
          />
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
            className={`${inputCls} md:col-span-2`}
          />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(1)
            }}
            className={`${inputCls} md:col-span-3`}
          >
            {actionOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'All Actions' : opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-3">Date &amp; Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-500">
                  No audit entries match the current filters.
                </td>
              </tr>
            ) : null}
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100">
                <td className="px-4 py-3 text-neutral-700">
                  {new Date(r.at).toLocaleString(undefined, {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900">{r.user || 'Admin'}</span>
                    {r.userRole === 'admin' ? (
                      <span className="inline-flex rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                        Admin
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${actionDot(r.action)}`} />
                    <span className="text-neutral-800">{r.action}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-700">{r.detail || '—'}</td>
                <td className="px-4 py-3 text-neutral-600">{r.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-neutral-600">
        <span>
          Showing {visible.length} of {filtered.length} entries
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
          >
            ← Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`rounded-md px-2 py-1 ${
                n === safePage
                  ? 'bg-[#D10000] text-white'
                  : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Danger Zone tab ─── */

function DangerTab() {
  const [feedback, setFeedback] = useState({ type: '', text: '' })

  function flash(type, text) {
    setFeedback({ type, text })
    window.setTimeout(() => setFeedback({ type: '', text: '' }), 4000)
  }

  function resetSales() {
    if (
      !window.confirm(
        'Reset ALL sales records and MVD points across every member? This cannot be undone.'
      )
    )
      return
    wipeSalesRecords()
    appendActivity({
      type: 'system',
      action: 'Reset sales records',
      detail: 'All orders and MVD entries cleared via Danger Zone',
    })
    flash('ok', 'Sales records and MVD points have been reset.')
  }

  function purgeInactive() {
    if (
      !window.confirm(
        'Purge all inactive members and their associated records? This cannot be undone.'
      )
    )
      return
    const result = purgeInactiveMembersDemo()
    appendActivity({
      type: 'system',
      action: 'Purged inactive members',
      detail: `Removed ${result.cleared} local records · backend cleanup still required`,
    })
    flash(
      'ok',
      'Inactive members purged from local cache. Use the backend admin API for permanent removal.'
    )
  }

  function archiveExpired() {
    const count = archiveExpiredPromotions()
    appendActivity({
      type: 'system',
      action: 'Archived expired promotions',
      detail: `${count} bulletin(s) archived`,
    })
    flash('ok', `${count} expired bulletin(s) archived.`)
  }

  function doFactoryReset() {
    if (
      !window.confirm(
        'FACTORY RESET: this wipes ALL admin data — members directory cache, sales, promotions, settings, and audit log. Continue?'
      )
    )
      return
    if (
      !window.confirm(
        'This is your last chance. Confirm factory reset? Reload the page after to see the clean state.'
      )
    )
      return
    factoryReset()
    flash('ok', 'Factory reset complete. Reload the page to apply.')
  }

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
        <span className="mt-0.5 text-lg" aria-hidden>
          ⚠️
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Warning — Destructive Actions Ahead
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Actions on this page are permanent and cannot be undone. Please ensure you have a full
            backup before proceeding. All destructive actions require confirmation before executing.
          </p>
        </div>
      </div>

      {feedback.text ? (
        <div
          className={`rounded-md border px-4 py-2 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      <DangerCard
        icon="🔁"
        title="Reset All Sales Records"
        badge={{ label: 'CAUTION', color: 'bg-amber-100 text-amber-800' }}
        description="Permanently deletes all sales data. MVD points will be reset to zero for all members. This action cannot be undone."
        cta="Reset Sales Records"
        onClick={resetSales}
      />

      <DangerCard
        icon="🗑"
        title="Purge Inactive Members"
        badge={{ label: 'IRREVERSIBLE', color: 'bg-rose-100 text-rose-800' }}
        description="Permanently removes all inactive member accounts and their associated records from the system."
        cta="Purge Inactive Members"
        onClick={purgeInactive}
      />

      <DangerCard
        icon="🗓"
        title="Archive All Expired Promotions"
        description="Moves all expired bulletins to the archive. They will no longer appear in the active promotions list."
        cta="Archive Expired Promos"
        onClick={archiveExpired}
        muted
      />

      <DangerCard
        icon="⛔"
        title="Factory Reset System"
        badge={{ label: 'COMPLETELY IRREVERSIBLE', color: 'bg-rose-100 text-rose-800' }}
        description="Wipes ALL data — members, sales, promotions, and settings. The system will return to its initial state. This action cannot be undone under any circumstances."
        cta="Factory Reset System"
        onClick={doFactoryReset}
      />
    </div>
  )
}

function DangerCard({ icon, title, badge, description, cta, onClick, muted }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-4 ${
        muted ? 'border-neutral-200 bg-white' : 'border-rose-200 bg-rose-50/40'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>
            {icon}
          </span>
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          {badge ? (
            <span
              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.color}`}
            >
              {badge.label}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-neutral-600">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${
          muted
            ? 'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
            : 'bg-[#D10000] text-white hover:bg-[#b30000]'
        }`}
      >
        {cta}
      </button>
    </div>
  )
}
