import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const navigate = useNavigate()
  
  // Local state
  const [authority, setAuthority] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'submitted' | 'processing' | 'resolved'

  useEffect(() => {
    // Check if logged in minimally first
    const localEmail = localStorage.getItem('authority_email')
    if (!localEmail) {
      navigate('/authority')
      return
    }

    initializeDashboard(localEmail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function initializeDashboard(email) {
    setLoading(true)
    // Run both fetches in parallel for speed
    await Promise.all([fetchAuthorityProfile(email), fetchComplaints()])
    setLoading(false)
  }

  async function fetchAuthorityProfile(email) {
    try {
      // Explicitly selecting fields to exclude 'password' for security
      const { data, error } = await supabase
        .from('authorities')
        .select('id, name, authority_id, phone, email')
        .eq('email', email)
        .single()

      if (error) {
        console.warn("Authority profile not found in DB, using local fallback.")
        // Fallback to local storage if DB fetch fails (for backward compatibility)
        setAuthority({
            name: localStorage.getItem('authority_name') || email.split('@')[0],
            email: email,
            authority_id: 'N/A'
        })
      } else {
        setAuthority(data)
        // Optional: Keep local storage in sync with DB name
        if (data.name) localStorage.setItem('authority_name', data.name)
      }
    } catch (err) {
      console.error('Failed to load profile', err)
    }
  }

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

  async function updateStatus(id, newStatus) {
    setUpdatingId(id)
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error

      // Optimistic update
      setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)))
    } catch (err) {
      alert('Failed to update status: ' + err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  function signOut() {
    localStorage.removeItem('authority_email')
    localStorage.removeItem('authority_name')
    navigate('/authority')
  }

  // --- Derived State for UI ---
  // Filtered list based on selected status
  const filteredComplaints = useMemo(() => {
    return statusFilter === 'all' 
      ? complaints 
      : complaints.filter(c => (c.status || 'submitted') === statusFilter)
  }, [complaints, statusFilter])

  // Statistics for the top cards
  const stats = useMemo(() => {
    return {
      total: complaints.length,
      submitted: complaints.filter(c => (c.status || 'submitted') === 'submitted').length,
      processing: complaints.filter(c => c.status === 'processing').length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
    }
  }, [complaints])

  // Helper to get badge colors
  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200'
      case 'processing': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-blue-100 text-blue-800 border-blue-200' // submitted
    }
  }

  if (loading && !authority) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading Dashboard...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Authority Dashboard</h1>
            {authority && (
               <div className="text-sm text-gray-500 flex items-center gap-3">
                 <span>{authority.name || authority.email}</span>
                 {authority.authority_id && <span className="bg-gray-200 px-2 rounded text-xs">ID: {authority.authority_id}</span>}
               </div>
            )}
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => initializeDashboard(authority?.email)} className="text-sm text-green-600 hover:text-green-800">
               Refresh Data
             </button>
             <button onClick={signOut} className="px-4 py-2 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-700 transition">
               Sign Out
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="mb-6 p-4 bg-red-50 text-red-700 border-l-4 border-red-500 rounded">{error}</div>}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Reports" value={stats.total} color="bg-white" onClick={() => setStatusFilter('all')} active={statusFilter === 'all'} />
          <StatCard label="Pending" value={stats.submitted} color="bg-blue-50" onClick={() => setStatusFilter('submitted')} active={statusFilter === 'submitted'} />
          <StatCard label="Processing" value={stats.processing} color="bg-yellow-50" onClick={() => setStatusFilter('processing')} active={statusFilter === 'processing'} />
          <StatCard label="Resolved" value={stats.resolved} color="bg-green-50" onClick={() => setStatusFilter('resolved')} active={statusFilter === 'resolved'} />
        </div>

        {/* Filters & Counts Row */}
        <div className="flex items-center justify-between mb-6">
           <h2 className="text-lg font-semibold text-gray-700">
             {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Complaints 
             <span className="ml-2 text-sm font-normal text-gray-500">({filteredComplaints.length})</span>
           </h2>
           
           {/* Mobile friendly dropdown filter could go here instead of tabs if needed */}
        </div>

        {/* Complaints Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredComplaints.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-lg border border-dashed">
              No complaints found in this category.
            </div>
          ) : (
            filteredComplaints.map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
                {/* Image Header */}
                <div className="relative h-48 bg-gray-100">
                  {c.image_url ? (
                    <a href={c.image_url} target="_blank" rel="noreferrer">
                      <img src={c.image_url} alt={`Report ${c.id}`} className="w-full h-full object-cover" loading="lazy" />
                    </a>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                       <span className="text-sm">No Image Provided</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 text-xs font-medium bg-white/90 text-gray-700 rounded-full shadow-sm">
                      {c.category || 'General'}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                     <div>
                       <h3 className="font-bold text-gray-800">ID: {c.formatted_id || `#${c.id}`}</h3>
                       <p className="text-xs text-gray-500">{c.district || 'Unknown Location'}</p>
                     </div>
                     {/* Status Badge (Static display when not editing is sometimes cleaner, but dropdown is functional) */}
                  </div>
                  
                  <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-grow italic bg-gray-50 p-2 rounded">
                    "{c.description || 'No description provided.'}"
                  </p>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                       <span>{new Date(c.timestamp).toLocaleDateString()}</span>
                       <span>{c.from_email ? 'Verified User' : 'Anonymous'}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-gray-700">Status:</label>
                      <select
                        value={c.status || 'submitted'}
                        onChange={(e) => updateStatus(c.id, e.target.value)}
                        disabled={updatingId === c.id}
                        className={`text-sm border rounded-md px-2 py-1.5 flex-1 cursor-pointer transition-colors ${getStatusColor(c.status || 'submitted')} ${updatingId === c.id ? 'opacity-50' : ''}`}
                      >
                        <option value="submitted">⚪ Submitted</option>
                        <option value="processing">🟡 Processing</option>
                        <option value="resolved">🟢 Resolved</option>
                      </select>
                    </div>
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

// Simple sub-component for stats
function StatCard({ label, value, color, onClick, active }) {
  return (
    <button 
      onClick={onClick}
      className={`${color} p-4 rounded-lg border transition-all text-left
        ${active ? 'ring-2 ring-green-500 border-transparent shadow-md' : 'border-gray-200 hover:border-green-300'}`}
    >
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </button>
  )
}