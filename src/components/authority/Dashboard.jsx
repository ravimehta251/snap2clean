import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const navigate = useNavigate()
  const [authority, setAuthority] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all') // added back for filtering
  const [refreshing, setRefreshing] = useState(false)

  // ✅ Load authority and complaints when logged in
  useEffect(() => {
    const localEmail = localStorage.getItem('authority_email')
    if (!localEmail) {
      navigate('/authority')
      return
    }
    initializeDashboard(localEmail)
  }, [])

  async function initializeDashboard(email) {
    setLoading(true)
    await Promise.all([fetchAuthorityProfile(email), fetchComplaints()])
    setLoading(false)
  }

  // ✅ Fetch authority profile
  async function fetchAuthorityProfile(email) {
    try {
      const { data, error } = await supabase
        .from('authorities')
        .select('id, name, authority_id, phone, email')
        .eq('email', email)
        .single()

      if (error) {
        console.warn('Authority profile not found in DB, using local fallback.')
        setAuthority({
          name: localStorage.getItem('authority_name') || email.split('@')[0],
          email: email,
          authority_id: 'N/A'
        })
      } else {
        setAuthority(data)
        if (data.name) localStorage.setItem('authority_name', data.name)
      }
    } catch (err) {
      console.error('Failed to load profile', err)
    }
  }

  // ✅ Fetch complaints
  async function fetchComplaints() {
    setError('')
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200)

      if (error) throw error
      setComplaints(data || [])
    } catch (err) {
      console.error('Failed to load complaints', err)
      setError('Failed to load complaints. Please refresh.')
    }
  }

  // ✅ Update complaint status
  async function updateStatus(id, newStatus) {
    setUpdatingId(id)
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error

      setComplaints((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      )
    } catch (err) {
      alert('Failed to update status: ' + err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  // ✅ Sign out function
  function signOut() {
    localStorage.removeItem('authority_email')
    localStorage.removeItem('authority_name')
    navigate('/authority')
  }

  // ✅ Filtered complaints
  const filteredComplaints = useMemo(() => {
    return statusFilter === 'all'
      ? complaints
      : complaints.filter((c) => (c.status || 'submitted') === statusFilter)
  }, [complaints, statusFilter])

  // ✅ Stats section
  const stats = useMemo(
    () => ({
      total: complaints.length,
      submitted: complaints.filter(
        (c) => (c.status || 'submitted') === 'submitted'
      ).length,
      processing: complaints.filter((c) => c.status === 'processing').length,
      resolved: complaints.filter((c) => c.status === 'resolved').length
    }),
    [complaints]
  )

  // ✅ Color helper
  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  if (loading && !authority) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading Dashboard...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ✅ Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Authority Dashboard</h1>
            {authority && (
              <div className="text-sm text-gray-500 flex items-center gap-3">
                <span>{authority.name || authority.email}</span>
                {authority.authority_id && (
                  <span className="bg-gray-200 px-2 rounded text-xs">
                    ID: {authority.authority_id}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => initializeDashboard(authority?.email)}
              className="text-sm text-green-600 hover:text-green-800"
            >
              Refresh Data
            </button>
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-700 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ✅ Main Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border-l-4 border-red-500 rounded">
            {error}
          </div>
        )}

        {/* ✅ Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Reports"
            value={stats.total}
            color="bg-white"
            onClick={() => setStatusFilter('all')}
            active={statusFilter === 'all'}
          />
          <StatCard
            label="Pending"
            value={stats.submitted}
            color="bg-blue-50"
            onClick={() => setStatusFilter('submitted')}
            active={statusFilter === 'submitted'}
          />
          <StatCard
            label="Processing"
            value={stats.processing}
            color="bg-yellow-50"
            onClick={() => setStatusFilter('processing')}
            active={statusFilter === 'processing'}
          />
          <StatCard
            label="Resolved"
            value={stats.resolved}
            color="bg-green-50"
            onClick={() => setStatusFilter('resolved')}
            active={statusFilter === 'resolved'}
          />
        </div>

        {/* ✅ Complaints Section */}
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Complaints{' '}
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({filteredComplaints.length})
          </span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredComplaints.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-lg border border-dashed">
              No complaints found in this category.
            </div>
          ) : (
            filteredComplaints.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/authority/complaint/${c.id}`)} // ✅ new page navigation
                className="cursor-pointer bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition overflow-hidden"
              >
                {/* ✅ Complaint Card */}
                <div className="relative h-48 bg-gray-100">
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={`Report ${c.id}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No Image Provided
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs">
                    {c.category || 'General'}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-800">
                        ID: {c.formatted_id || `#${c.id}`}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {c.district || 'Unknown Location'}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-grow italic bg-gray-50 p-2 rounded">
                    "{c.description || 'No description provided.'}"
                  </p>

                  {/* ✅ Status Dropdown */}
                  {/* Status Dropdown */}
<div className="flex items-center justify-between gap-2">
  <label className="text-xs font-semibold text-gray-700">
    Status:
  </label>

  <select
    // IMPORTANT: stop propagation so clicking the select doesn't open complaint details
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
    onFocus={(e) => e.stopPropagation()}
    value={c.status || 'submitted'}
    onChange={(e) => {
      // still update status optimistically as before
      updateStatus(c.id, e.target.value)
    }}
    disabled={updatingId === c.id}
    className={`text-sm border rounded-md px-2 py-1.5 flex-1 cursor-pointer transition-colors ${getStatusColor(
      c.status || 'submitted'
    )} ${updatingId === c.id ? 'opacity-50' : ''}`}
  >
    <option value="submitted">⚪ Submitted</option>
    <option value="processing">🟡 Processing</option>
    <option value="resolved">🟢 Resolved</option>
  </select>
</div>

                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}

// ✅ StatCard sub-component
function StatCard({ label, value, color, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`${color} p-4 rounded-lg border transition-all text-left ${
        active
          ? 'ring-2 ring-green-500 border-transparent shadow-md'
          : 'border-gray-200 hover:border-green-300'
      }`}
    >
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </button>
  )
}
