import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { appendActivity } from '../../utils/adminStorage'
import { POSITIONS } from '../../constants/positions'

const LIMIT = 20

function fc() {
  return 'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-[#D10000] focus:outline-none focus:ring-1 focus:ring-[#D10000]'
}

function fcSmall() {
  return 'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-[#D10000] focus:outline-none focus:ring-1 focus:ring-[#D10000]'
}

function SectionHeader({ children }) {
  return (
    <div className="bg-[#D10000] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
      {children}
    </div>
  )
}

function Label({ children, required }) {
  return (
    <label className="mb-1 block text-sm font-medium text-neutral-800">
      {required ? <span className="text-[#D10000]">* </span> : null}
      {children}
    </label>
  )
}

function statusLabel(s) {
  if (s === 'active') return 'Active'
  if (s === 'suspended') return 'Suspended'
  if (s === 'pending_verification') return 'Pending'
  return s || '—'
}

const DEFAULT_TEMP_PASSWORD = '123'

function InfoItem({ label, value }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-neutral-900">{value || '—'}</p>
    </div>
  )
}

function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export default function MemberDetailPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [accountStatus, setAccountStatus] = useState('pending_verification')
  const [memberCategory, setMemberCategory] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [recruitedBy, setRecruitedBy] = useState('')

  const [teamMembers, setTeamMembers] = useState([])

  const [teamFilterName, setTeamFilterName] = useState('')
  const [teamFilterPhone, setTeamFilterPhone] = useState('')
  const [teamFilterEmail, setTeamFilterEmail] = useState('')
  const [teamFilterAddress, setTeamFilterAddress] = useState('')
  const [teamFilterRole, setTeamFilterRole] = useState('')
  const [teamFilterStatus, setTeamFilterStatus] = useState('')
  const [teamFilterDate, setTeamFilterDate] = useState('')
  const [teamPage, setTeamPage] = useState(1)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const selectAllRef = useRef(null)
  const [showEditInfo, setShowEditInfo] = useState(false)

  const roleOptions = useMemo(() => roles, [roles])
  const assignableRoles = useMemo(
    () => roles.filter((r) => r.name !== 'admin'),
    [roles]
  )
  const currentRole = useMemo(
    () => roles.find((r) => String(r.id) === String(roleId)),
    [roles, roleId]
  )
  const currentPosition = useMemo(
    () => POSITIONS.find((p) => p.value === memberCategory),
    [memberCategory]
  )

  function resetTeamFilters() {
    setTeamFilterName('')
    setTeamFilterPhone('')
    setTeamFilterEmail('')
    setTeamFilterAddress('')
    setTeamFilterRole('')
    setTeamFilterStatus('')
    setTeamFilterDate('')
  }

  function teamAddressString(m) {
    return [m.addr_street, m.addr_barangay, m.addr_city, m.addr_province, m.addr_region]
      .filter(Boolean)
      .join(', ')
  }

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [detail, rolesData] = await Promise.all([
        api(`/admin/users/${userId}`),
        api('/admin/roles'),
      ])
      setRoles(rolesData.roles || [])
      const u = detail.user
      setEmail(u.email || '')
      setFullName(u.full_name || '')
      setPhone(u.phone || '')
      setRoleId(String(u.role_id))
      setAccountStatus(u.account_status || 'pending_verification')
      setMemberCategory(u.member_category || '')
      setRecruitedBy(u.recruited_by || '')
      setTeamMembers(detail.team_members || [])
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setTeamPage(1)
  }, [
    teamFilterName,
    teamFilterPhone,
    teamFilterEmail,
    teamFilterAddress,
    teamFilterRole,
    teamFilterStatus,
    teamFilterDate,
  ])

  const filteredTeam = useMemo(() => {
    const name = teamFilterName.trim().toLowerCase()
    const phone = teamFilterPhone.trim().toLowerCase()
    const email = teamFilterEmail.trim().toLowerCase()
    const address = teamFilterAddress.trim().toLowerCase()
    const role = teamFilterRole
    const status = teamFilterStatus
    const dateAdded = teamFilterDate

    return teamMembers.filter((m) => {
      if (name && !String(m.full_name || '').toLowerCase().includes(name)) return false
      if (phone && !String(m.phone || '').toLowerCase().includes(phone)) return false
      if (email && !String(m.email || '').toLowerCase().includes(email)) return false
      if (address && !teamAddressString(m).toLowerCase().includes(address)) return false
      if (role && String(m.role || '').toLowerCase() !== role.toLowerCase()) return false
      if (status && m.account_status !== status) return false
      if (dateAdded) {
        if (!m.created_at) return false
        const iso = new Date(m.created_at).toISOString().slice(0, 10)
        if (iso !== dateAdded) return false
      }
      return true
    })
  }, [
    teamMembers,
    teamFilterName,
    teamFilterPhone,
    teamFilterEmail,
    teamFilterAddress,
    teamFilterRole,
    teamFilterStatus,
    teamFilterDate,
  ])

  const teamTotal = filteredTeam.length
  const teamTotalPages = Math.max(1, Math.ceil(teamTotal / LIMIT))
  const teamPageClamped = Math.min(teamPage, teamTotalPages)
  const teamSlice = useMemo(() => {
    const p = Math.max(0, teamPageClamped - 1)
    return filteredTeam.slice(p * LIMIT, p * LIMIT + LIMIT)
  }, [filteredTeam, teamPageClamped])

  const pageIds = teamSlice.map((u) => u.id)
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const somePageSelected = pageIds.some((id) => selectedIds.has(id))

  useEffect(() => {
    const el = selectAllRef.current
    if (el) {
      el.indeterminate = somePageSelected && !allPageSelected
    }
  }, [somePageSelected, allPageSelected, selectMode, teamSlice])

  function cancelSelection() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function toggleRow(id, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSelectAllOnPage(checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        pageIds.forEach((id) => next.add(id))
      } else {
        pageIds.forEach((id) => next.delete(id))
      }
      return next
    })
  }

  async function deleteSelected() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    if (
      !window.confirm(
        `Delete ${ids.length} member(s) permanently? This cannot be undone.`
      )
    ) {
      return
    }
    setBusy(true)
    setErr('')
    try {
      for (const id of ids) {
        await api(`/admin/users/${id}`, { method: 'DELETE' })
      }
      appendActivity({
        type: 'users',
        action: 'Team members bulk deleted',
        detail: `${ids.length} account(s)`,
      })
      cancelSelection()
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const body = {
        email: email.trim(),
        full_name: fullName.trim(),
        phone: phone.trim(),
        role_id: Number(roleId),
        account_status: accountStatus,
        member_category: memberCategory.trim() || null,
        recruited_by: recruitedBy.trim() || null,
      }
      if (newPassword.trim().length > 0) {
        body.password = newPassword.trim()
      }
      await api(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      appendActivity({
        type: 'users',
        action: 'Member updated',
        detail: fullName.trim() || email,
      })
      setNewPassword('')
      await load()
      setShowEditInfo(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function cancelEditInfo() {
    setShowEditInfo(false)
    setNewPassword('')
    await load()
  }

  async function removeMember() {
    if (
      !window.confirm(
        'Delete this member permanently? This cannot be undone.'
      )
    ) {
      return
    }
    setBusy(true)
    setErr('')
    try {
      await api(`/admin/users/${userId}`, { method: 'DELETE' })
      appendActivity({
        type: 'users',
        action: 'Member deleted',
        detail: userId,
      })
      navigate('/admin/users')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const c = fc()

  if (loading) {
    return (
      <div className="w-full py-12 text-center text-sm text-neutral-500">Loading…</div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/admin/users"
            className="text-sm font-medium text-[#D10000] hover:underline"
          >
            ← Back to member directory
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-neutral-900">Member profile</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Review this member&apos;s account information and sponsored team. Use Edit info to
            update account details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowEditInfo((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
          >
            <EditIcon /> {showEditInfo ? 'Hide edit' : 'Edit info'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={removeMember}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
          >
            Delete member
          </button>
        </div>
      </div>

      <div
        className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
      >
        <SectionHeader>Account information</SectionHeader>
        <div className="grid grid-cols-1 gap-4 bg-[#f5f5f5] px-4 py-5 md:grid-cols-2 md:px-6 lg:grid-cols-3">
          <InfoItem label="Email" value={email} />
          <InfoItem label="Phone" value={phone} />
          <InfoItem label="Full name" value={fullName} />
          <InfoItem label="Role" value={currentRole?.name || '—'} />
          <InfoItem label="Account status" value={statusLabel(accountStatus)} />
          <InfoItem label="Position" value={currentPosition?.label || '—'} />
          <InfoItem label="Sponsor member ID (UUID)" value={recruitedBy} />
          <InfoItem
            label="Password"
            value={`Hidden for security. Default temporary password: ${DEFAULT_TEMP_PASSWORD}`}
          />
        </div>
      </div>

      {showEditInfo ? (
        <form
          onSubmit={save}
          className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
        >
          <SectionHeader>Edit account information</SectionHeader>
        <div className="space-y-4 bg-[#f5f5f5] px-4 py-5 md:px-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label required>Email</Label>
              <input
                required
                type="email"
                className={c}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label required>Phone</Label>
              <input
                required
                className={c}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <Label required>Full name</Label>
              <input
                required
                className={c}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <Label required>Role</Label>
              <select
                required
                className={c}
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label required>Account status</Label>
              <select
                required
                className={c}
                value={accountStatus}
                onChange={(e) => setAccountStatus(e.target.value)}
              >
                <option value="pending_verification">Pending verification</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <Label>Position</Label>
              <select
                className={c}
                value={memberCategory}
                onChange={(e) => setMemberCategory(e.target.value)}
              >
                <option value="">— Not assigned —</option>
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Sponsor member ID (UUID)</Label>
              <input
                className={c}
                value={recruitedBy}
                onChange={(e) => setRecruitedBy(e.target.value)}
                placeholder="Clear to remove link"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <Label>Password information</Label>
              <div className="mb-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
                Current password is hidden for security. New accounts use the default temporary
                password <span className="font-semibold text-neutral-900">{DEFAULT_TEMP_PASSWORD}</span> unless a
                custom password was entered during registration.
              </div>
              <Label>Reset password (optional)</Label>
              <input
                type="password"
                className={c}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-200 bg-white px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#D10000] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#b30000] disabled:opacity-50"
            >
              Save changes
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelEditInfo}
              className="rounded-lg border border-neutral-300 bg-white px-6 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
        </form>
      ) : null}

      <div className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-neutral-50/80 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-neutral-800">Members (team)</h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-neutral-500">
                {teamTotal} total · page {teamPageClamped} of {teamTotalPages}
              </span>
              <button
                type="button"
                onClick={resetTeamFilters}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Reset filters
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Member name</span>
              <input
                type="search"
                value={teamFilterName}
                onChange={(e) => setTeamFilterName(e.target.value)}
                placeholder="Search name…"
                className={fcSmall()}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Phone</span>
              <input
                type="search"
                value={teamFilterPhone}
                onChange={(e) => setTeamFilterPhone(e.target.value)}
                placeholder="09…"
                className={fcSmall()}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Email</span>
              <input
                type="search"
                value={teamFilterEmail}
                onChange={(e) => setTeamFilterEmail(e.target.value)}
                placeholder="name@example.com"
                className={fcSmall()}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Address</span>
              <input
                type="search"
                value={teamFilterAddress}
                onChange={(e) => setTeamFilterAddress(e.target.value)}
                placeholder="Street, barangay, city…"
                className={fcSmall()}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Role</span>
              <select
                value={teamFilterRole}
                onChange={(e) => setTeamFilterRole(e.target.value)}
                className={fcSmall()}
              >
                <option value="">All roles</option>
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Status</span>
              <select
                value={teamFilterStatus}
                onChange={(e) => setTeamFilterStatus(e.target.value)}
                className={fcSmall()}
              >
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending_verification">Pending</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Date added</span>
              <input
                type="date"
                value={teamFilterDate}
                onChange={(e) => setTeamFilterDate(e.target.value)}
                className={fcSmall()}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Sponsored accounts for this member. Filters apply locally to the loaded team.
          </p>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-100/90 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                {selectMode ? (
                  <th className="w-10 px-2 py-3 text-center">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300 text-[#D10000] focus:ring-[#D10000]"
                      checked={allPageSelected}
                      onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                      aria-label="Select all on this page"
                    />
                  </th>
                ) : null}
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date added</th>
                {!selectMode ? (
                  <th className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectMode(true)}
                      className="rounded-md bg-[#D10000] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#b30000]"
                    >
                      SELECT
                    </button>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {teamSlice.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-neutral-500"
                  >
                    {teamMembers.length === 0
                      ? 'No sponsored members yet.'
                      : 'No team members match your filters.'}
                  </td>
                </tr>
              ) : (
                teamSlice.map((u) => (
                  <tr
                    key={u.id}
                    onDoubleClick={() => {
                      if (!selectMode) navigate(`/admin/users/${u.id}`)
                    }}
                    className={`border-b border-neutral-100 hover:bg-neutral-50/80 ${!selectMode ? 'cursor-pointer' : ''}`}
                  >
                    {selectMode ? (
                      <td
                        className="w-10 px-2 py-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300 text-[#D10000] focus:ring-[#D10000]"
                          checked={selectedIds.has(u.id)}
                          onChange={(e) => toggleRow(u.id, e.target.checked)}
                          aria-label={`Select ${u.full_name}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3 font-medium text-neutral-900">{u.full_name}</td>
                    <td className="px-4 py-3 text-neutral-600">{u.phone || '—'}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-neutral-600">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {teamAddressString(u) || '—'}
                    </td>
                    <td className="px-4 py-3 capitalize text-neutral-800">{u.role}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.account_status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.account_status === 'suspended'
                              ? 'bg-neutral-200 text-neutral-700'
                              : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {statusLabel(u.account_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 tabular-nums">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    {!selectMode ? <td className="px-4 py-3" aria-hidden /> : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3">
          <button
            type="button"
            disabled={teamPageClamped <= 1 || busy}
            onClick={() => setTeamPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-40"
          >
            Previous
          </button>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
            {selectMode ? (
              <>
                <button
                  type="button"
                  disabled={busy || selectedIds.size === 0}
                  onClick={deleteSelected}
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-1.5 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-40"
                >
                  Delete
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelSelection}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
                >
                  Cancel
                </button>
              </>
            ) : null}
          </div>
          <button
            type="button"
            disabled={teamPageClamped >= teamTotalPages || busy}
            onClick={() => setTeamPage((p) => p + 1)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

    </div>
  )
}
