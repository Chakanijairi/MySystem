import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { appendActivity } from '../../utils/adminStorage'
import { useAuth } from '../../context/AuthContext'
import { REGION_OPTIONS } from '../../constants/phRegions'
import {
  POSITIONS,
  positionBadgeClass,
  positionLabel,
} from '../../constants/positions'

const LIMIT = 20
const DEFAULT_TEMP_PASSWORD = '123'

function fieldClass() {
  return 'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-[#D10000] focus:outline-none focus:ring-1 focus:ring-[#D10000]'
}

function SectionHeader({ children }) {
  return (
    <div className="bg-[#D10000] px-4 py-2.5 text-sm font-bold text-white">
      {children}
    </div>
  )
}

function Label({ children, optional }) {
  return (
    <label className="mb-1 block text-xs font-medium text-neutral-700">
      {children}
      {optional ? (
        <span className="ml-1 text-xs font-normal italic text-[#D10000]">(Optional)</span>
      ) : null}
    </label>
  )
}

function initialNewUser(defaultRoleId) {
  return {
    first_name: '',
    last_name: '',
    middle_name: '',
    phone: '',
    email: '',
    addr_street: '',
    addr_region: '',
    addr_province: '',
    addr_city: '',
    addr_barangay: '',
    recruiter_id: '',
    recruiter_name: '',
    recruiter_mobile: '',
    recruiter_facebook: '',
    password: '',
    role_id: defaultRoleId || '',
    member_category: '',
  }
}

function StatusDot({ status }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D10000]">
        <span className="h-2 w-2 rounded-full bg-[#D10000]" /> Active
      </span>
    )
  }
  if (status === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <span className="h-2 w-2 rounded-full bg-neutral-400" /> Inactive
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
      <span className="h-2 w-2 rounded-full bg-amber-500" /> Pending
    </span>
  )
}

export default function UserManagement() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [newUser, setNewUser] = useState(() => initialNewUser(''))
  const [filterName, setFilterName] = useState('')
  const [filterPhone, setFilterPhone] = useState('')
  const [filterEmail, setFilterEmail] = useState('')
  const [filterAddress, setFilterAddress] = useState('')
  const [filterPosition, setFilterPosition] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [debouncedFilters, setDebouncedFilters] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    position: '',
    status: '',
    dateAdded: '',
  })

  const [recruiterQuery, setRecruiterQuery] = useState('')
  const [recruiterResults, setRecruiterResults] = useState([])
  const [recruiterSearching, setRecruiterSearching] = useState(false)
  const [showRecruiterDropdown, setShowRecruiterDropdown] = useState(false)

  const assignableRoles = useMemo(
    () => roles.filter((r) => r.name !== 'admin'),
    [roles]
  )

  useEffect(() => {
    if (!newUser.role_id && assignableRoles.length > 0) {
      const member = assignableRoles.find((r) => r.name === 'member')
      const fallback = member?.id ?? assignableRoles[0].id
      setNewUser((u) => ({ ...u, role_id: String(fallback) }))
    }
  }, [assignableRoles, newUser.role_id])

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(LIMIT))
    params.set('excludeAdmin', 'true')
    if (debouncedFilters.name) params.set('memberName', debouncedFilters.name)
    if (debouncedFilters.phone) params.set('phone', debouncedFilters.phone)
    if (debouncedFilters.email) params.set('email', debouncedFilters.email)
    if (debouncedFilters.address) params.set('address', debouncedFilters.address)
    if (debouncedFilters.position) params.set('position', debouncedFilters.position)
    if (debouncedFilters.status) params.set('status', debouncedFilters.status)
    if (debouncedFilters.dateAdded) params.set('dateAdded', debouncedFilters.dateAdded)
    const data = await api(`/admin/users?${params.toString()}`)
    setUsers(data.users || [])
    setTotal(data.total || 0)
  }, [page, debouncedFilters])

  const loadRoles = useCallback(async () => {
    const data = await api('/admin/roles')
    const list = data.roles || []
    setRoles(list)
    const memberId = String(list.find((r) => r.name === 'member')?.id || '')
    setNewUser((u) => ({
      ...u,
      role_id: u.role_id || memberId,
    }))
  }, [])

  useEffect(() => {
    setErr('')
    loadRoles().catch((e) => setErr(e.message))
  }, [loadRoles])

  useEffect(() => {
    const t = setTimeout(
      () =>
        setDebouncedFilters({
          name: filterName.trim(),
          phone: filterPhone.trim(),
          email: filterEmail.trim(),
          address: filterAddress.trim(),
          position: filterPosition,
          status: filterStatus,
          dateAdded: filterDate,
        }),
      350
    )
    return () => clearTimeout(t)
  }, [
    filterName,
    filterPhone,
    filterEmail,
    filterAddress,
    filterPosition,
    filterStatus,
    filterDate,
  ])

  useEffect(() => {
    setPage(1)
  }, [debouncedFilters])

  useEffect(() => {
    // Recruiter is already linked → don't keep searching while admin edits visible fields.
    if (newUser.recruiter_id) return
    const q = recruiterQuery.trim()
    if (q.length < 2) {
      setRecruiterResults([])
      setRecruiterSearching(false)
      return
    }
    setRecruiterSearching(true)
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        params.set('memberName', q)
        params.set('limit', '8')
        const data = await api(`/admin/users?${params.toString()}`)
        const me = authUser?.id
        const list = (data.users || []).filter(
          (u) => (u.role || '').toLowerCase() !== 'admin' && u.id !== me
        )
        setRecruiterResults(list)
      } catch {
        setRecruiterResults([])
      } finally {
        setRecruiterSearching(false)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [recruiterQuery, newUser.recruiter_id, authUser?.id])

  function pickRecruiter(u) {
    setNewUser((prev) => ({
      ...prev,
      recruiter_id: u.id,
      recruiter_name: u.full_name || '',
      recruiter_mobile: u.phone || '',
    }))
    setRecruiterQuery(u.full_name || '')
    setRecruiterResults([])
    setShowRecruiterDropdown(false)
  }

  function clearRecruiter() {
    setNewUser((prev) => ({
      ...prev,
      recruiter_id: '',
      recruiter_name: '',
      recruiter_mobile: '',
    }))
    setRecruiterQuery('')
    setRecruiterResults([])
  }

  function resetFilters() {
    setFilterName('')
    setFilterPhone('')
    setFilterEmail('')
    setFilterAddress('')
    setFilterPosition('')
    setFilterStatus('')
    setFilterDate('')
  }

  useEffect(() => {
    setErr('')
    loadUsers().catch((e) => setErr(e.message))
  }, [loadUsers])

  async function createUser(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setSuccess('')
    try {
      const roleIdNum = Number(newUser.role_id)
      if (!roleIdNum) {
        throw new Error('Please select a role before registering.')
      }
      const passwordToSend = newUser.password.trim() || DEFAULT_TEMP_PASSWORD
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newUser.email,
          password: passwordToSend,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          middle_name: newUser.middle_name || null,
          phone: newUser.phone,
          addr_street: newUser.addr_street,
          addr_region: newUser.addr_region,
          addr_province: newUser.addr_province,
          addr_city: newUser.addr_city,
          addr_barangay: newUser.addr_barangay || '',
          recruiter_id: newUser.recruiter_id || null,
          recruiter_name: newUser.recruiter_name || null,
          recruiter_mobile: newUser.recruiter_mobile || null,
          recruiter_facebook: newUser.recruiter_facebook || null,
          role_id: roleIdNum,
          member_category: newUser.member_category || null,
        }),
      })
      const displayName = [newUser.first_name, newUser.last_name].filter(Boolean).join(' ')
      const roleName =
        roles.find((r) => Number(r.id) === roleIdNum)?.name || 'user'
      appendActivity({
        type: 'users',
        action: 'User registered',
        detail: `${displayName} · ${newUser.email}`,
      })
      const memberId = String(roles.find((r) => r.name === 'member')?.id || '')
      setNewUser(initialNewUser(memberId))
      setRecruiterQuery('')
      setRecruiterResults([])
      setSuccess(`Registered ${displayName || newUser.email} as ${roleName}.`)
      window.setTimeout(() => setSuccess(''), 4000)
      await loadUsers()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const fc = fieldClass()

  return (
    <div className="w-full space-y-5">
      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <h2 className="text-xl font-bold text-neutral-900">Member Registration</h2>

      <form
        onSubmit={createUser}
        className="w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm"
      >
        {/* ── Applicant Information ── */}
        <SectionHeader>Applicant Information</SectionHeader>
        <div className="bg-white px-4 py-5 md:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label>First Name</Label>
              <input
                required
                className={fc}
                placeholder="First Name"
                value={newUser.first_name}
                onChange={(e) => setNewUser((u) => ({ ...u, first_name: e.target.value }))}
                autoComplete="given-name"
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <input
                required
                className={fc}
                placeholder="Last Name"
                value={newUser.last_name}
                onChange={(e) => setNewUser((u) => ({ ...u, last_name: e.target.value }))}
                autoComplete="family-name"
              />
            </div>
            <div>
              <Label>Middle Name</Label>
              <input
                className={fc}
                placeholder="Middle Name"
                value={newUser.middle_name}
                onChange={(e) => setNewUser((u) => ({ ...u, middle_name: e.target.value }))}
                autoComplete="additional-name"
              />
            </div>
            <div>
              <Label>Mobile Number</Label>
              <input
                required
                className={fc}
                placeholder="09"
                value={newUser.phone}
                onChange={(e) => setNewUser((u) => ({ ...u, phone: e.target.value }))}
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
            <div>
              <Label>Email Address</Label>
              <input
                required
                type="email"
                className={fc}
                placeholder="Email Address"
                value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label>House No. / Street</Label>
              <input
                required
                className={fc}
                placeholder="House No. / Street"
                value={newUser.addr_street}
                onChange={(e) => setNewUser((u) => ({ ...u, addr_street: e.target.value }))}
              />
            </div>
            <div>
              <Label>Region</Label>
              <select
                required
                className={fc}
                value={newUser.addr_region}
                onChange={(e) => setNewUser((u) => ({ ...u, addr_region: e.target.value }))}
              >
                <option value="">--SELECT--</option>
                {REGION_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Province</Label>
              <input
                required
                className={fc}
                placeholder="Province"
                value={newUser.addr_province}
                onChange={(e) => setNewUser((u) => ({ ...u, addr_province: e.target.value }))}
              />
            </div>
            <div>
              <Label>City / Municipality</Label>
              <input
                required
                className={fc}
                placeholder="City / Municipality"
                value={newUser.addr_city}
                onChange={(e) => setNewUser((u) => ({ ...u, addr_city: e.target.value }))}
              />
            </div>
            <div>
              <Label>Barangay</Label>
              <input
                className={fc}
                placeholder="Barangay"
                value={newUser.addr_barangay}
                onChange={(e) => setNewUser((u) => ({ ...u, addr_barangay: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* ── Recruiter Information ── */}
        <SectionHeader>Recruiter Information</SectionHeader>
        <div className="bg-white px-4 py-5 md:px-6">
          <div className="mb-4">
            <Label>Search existing recruiter</Label>
            {newUser.recruiter_id ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2">
                <span className="inline-flex items-center gap-2 text-sm text-emerald-900">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    ✓
                  </span>
                  <span>
                    Linked to{' '}
                    <span className="font-semibold">{newUser.recruiter_name}</span>. New
                    member will appear in their team.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={clearRecruiter}
                  className="ml-auto rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  Change recruiter
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className={fc}
                  placeholder="Type a member's name to link them as recruiter…"
                  value={recruiterQuery}
                  onChange={(e) => {
                    setRecruiterQuery(e.target.value)
                    setShowRecruiterDropdown(true)
                  }}
                  onFocus={() => setShowRecruiterDropdown(true)}
                  onBlur={() => setTimeout(() => setShowRecruiterDropdown(false), 150)}
                  autoComplete="off"
                />
                {showRecruiterDropdown &&
                (recruiterQuery.trim().length >= 2 ||
                  recruiterSearching ||
                  recruiterResults.length > 0) ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
                    {recruiterSearching ? (
                      <div className="px-3 py-2 text-xs text-neutral-500">Searching…</div>
                    ) : recruiterResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-neutral-500">
                        No member matches "{recruiterQuery}". You can still type the name
                        below as free text.
                      </div>
                    ) : (
                      recruiterResults.map((r) => (
                        <button
                          type="button"
                          key={r.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickRecruiter(r)}
                          className="flex w-full flex-col items-start gap-0.5 border-b border-neutral-100 px-3 py-2 text-left hover:bg-neutral-50"
                        >
                          <span className="text-sm font-medium text-neutral-900">
                            {r.full_name}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {r.email}
                            {r.phone ? ` · ${r.phone}` : ''}
                            {r.role ? ` · ${r.role}` : ''}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
                <p className="mt-1 text-xs text-neutral-500">
                  Pick a member to link this new account to their team. Leave blank or unmatched to
                  store only the recruiter name below as free text.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Recruiter Full Name</Label>
              <input
                className={`${fc} ${newUser.recruiter_id ? 'bg-neutral-100' : ''}`}
                placeholder="Recruiter's Name"
                value={newUser.recruiter_name}
                onChange={(e) =>
                  setNewUser((u) => ({ ...u, recruiter_name: e.target.value }))
                }
                disabled={!!newUser.recruiter_id}
              />
            </div>
            <div>
              <Label optional>Recruiter Mobile No.</Label>
              <input
                className={`${fc} ${newUser.recruiter_id ? 'bg-neutral-100' : ''}`}
                placeholder="09"
                value={newUser.recruiter_mobile}
                onChange={(e) =>
                  setNewUser((u) => ({ ...u, recruiter_mobile: e.target.value }))
                }
                inputMode="tel"
                disabled={!!newUser.recruiter_id}
              />
            </div>
            <div>
              <Label optional>Recruiter Facebook Profile</Label>
              <input
                className={fc}
                placeholder="Recruiter Facebook Profile"
                value={newUser.recruiter_facebook}
                onChange={(e) =>
                  setNewUser((u) => ({ ...u, recruiter_facebook: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {/* ── Other Information ── */}
        <SectionHeader>Other Information</SectionHeader>
        <div className="bg-white px-4 py-5 md:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label optional>Temporary Password</Label>
              <input
                type="text"
                className={fc}
                placeholder="Temporary Password"
                value={newUser.password}
                onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                autoComplete="off"
              />
              <p className="mt-1 text-xs font-medium text-emerald-600">
                Password is automatically set to 123.
              </p>
            </div>
            <div>
              <Label>Role (Access Level)</Label>
              <select
                required
                className={fc}
                value={newUser.role_id}
                onChange={(e) => setNewUser((u) => ({ ...u, role_id: e.target.value }))}
              >
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label optional>Position</Label>
              <select
                className={fc}
                value={newUser.member_category}
                onChange={(e) =>
                  setNewUser((u) => ({ ...u, member_category: e.target.value }))
                }
              >
                <option value="">— Not assigned —</option>
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5">
            <button
              type="submit"
              disabled={busy || assignableRoles.length === 0 || !newUser.role_id}
              className="rounded-md bg-[#D10000] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#b30000] disabled:opacity-50"
            >
              {busy ? 'Registering…' : 'Register User'}
            </button>
          </div>
        </div>
      </form>

      {/* ── Member Directory ── */}
      <div className="w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-4 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-800">Member Directory</h2>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Reset filters
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Member name</span>
              <input
                type="search"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Search name…"
                className={fc}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Phone</span>
              <input
                type="search"
                value={filterPhone}
                onChange={(e) => setFilterPhone(e.target.value)}
                placeholder="09…"
                className={fc}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Email</span>
              <input
                type="search"
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
                placeholder="name@example.com"
                className={fc}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Address</span>
              <input
                type="search"
                value={filterAddress}
                onChange={(e) => setFilterAddress(e.target.value)}
                placeholder="Street, barangay, city…"
                className={fc}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Position</span>
              <select
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className={fc}
              >
                <option value="">All positions</option>
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Status</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={fc}
              >
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="suspended">Inactive</option>
                <option value="pending_verification">Pending</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Date added</span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={fc}
              />
            </label>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date added</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-neutral-500">
                    No members found.
                  </td>
                </tr>
              ) : null}
              {users.map((u) => (
                <tr
                  key={u.id}
                  onDoubleClick={() => navigate(`/admin/users/${u.id}`)}
                  className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50/80"
                >
                  <td className="px-4 py-3 font-medium text-neutral-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-neutral-700">{u.phone || '—'}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-[#1d4ed8] underline decoration-1 underline-offset-2">
                    {u.email}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {[u.addr_street, u.addr_barangay, u.addr_city, u.addr_province]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {u.member_category ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${positionBadgeClass(u.member_category)}`}
                      >
                        {positionLabel(u.member_category)}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusDot status={u.account_status} />
                  </td>
                  <td className="px-4 py-3 text-neutral-700 tabular-nums">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-neutral-100 px-4 py-3">
          <button
            type="button"
            disabled={page <= 1 || busy}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-neutral-300 bg-white px-4 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages || busy}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-neutral-300 bg-white px-4 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        Signed in as <span className="font-medium text-neutral-700">{authUser?.role || '—'}</span>. Double-click a member to open their profile.
      </p>
    </div>
  )
}
