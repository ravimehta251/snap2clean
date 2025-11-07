import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ComplaintDetails() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint, setComplaint] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchComplaint()
  }, [id])

  // ✅ Fetch complaint details
  async function fetchComplaint() {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setComplaint(data)
      fetchMessages(data.formatted_id) // fetch chat by formatted_id
      subscribeToMessages(data.formatted_id) // realtime updates
    } catch (err) {
      console.error(err)
      setError('Failed to load complaint details')
    } finally {
      setLoading(false)
    }
  }

  // ✅ Fetch chat messages for this complaint (using formatted_id)
  async function fetchMessages(formattedId) {
    const { data, error } = await supabase
      .from('complaint_messages')
      .select('*')
      .eq('formatted_id', formattedId)
      .order('timestamp', { ascending: true })

    if (!error) setMessages(data || [])
  }

  // ✅ Subscribe to live chat updates
  function subscribeToMessages(formattedId) {
    const channel = supabase
      .channel('complaint_chat_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'complaint_messages',
          filter: `formatted_id=eq.${formattedId}`,
        },
        () => fetchMessages(formattedId)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  // ✅ Send message from authority
  async function sendMessage() {
    if (!newMessage.trim()) return
    setSending(true)
    try {
      const authorityEmail = localStorage.getItem('authority_email') || 'authority@unknown.com'

      const { error } = await supabase.from('complaint_messages').insert([
        {
          formatted_id: complaint.formatted_id,
          sender: 'authority',
          sender_email: authorityEmail,
          message: newMessage.trim(),
        },
      ])

      if (error) throw error
      setNewMessage('')
      fetchMessages(complaint.formatted_id)
    } catch (err) {
      console.error('Failed to send message:', err)
      alert('Message failed to send.')
    } finally {
      setSending(false)
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading complaint...
      </div>
    )
  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        {error}
      </div>
    )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <button
        onClick={() => navigate(-1)}
        className="text-blue-600 hover:underline mb-4"
      >
        ← Back to Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
        {/* ✅ LEFT SIDE — Complaint Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Complaint {complaint.formatted_id}
          </h1>
          <p className="text-sm text-gray-600 mb-4">
            {new Date(complaint.timestamp).toLocaleString()}
          </p>

          {complaint.image_url && (
            <img
              src={complaint.image_url}
              alt="Complaint"
              className="w-full h-64 object-cover rounded mb-4"
            />
          )}

          <p className="text-gray-700 mb-4 italic">
            "{complaint.description || 'No description provided.'}"
          </p>

          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div><span className="font-semibold">District:</span> {complaint.district || 'Unknown'}</div>
            <div><span className="font-semibold">From:</span> {complaint.from_email || 'Anonymous'}</div>
            <div><span className="font-semibold">Status:</span> {complaint.status || 'submitted'}</div>
            <div><span className="font-semibold">Category:</span> {complaint.category || 'General'}</div>
            <div><span className="font-semibold">Latitude:</span> {complaint.latitude || 'N/A'}</div>
            <div><span className="font-semibold">Longitude:</span> {complaint.longitude || 'N/A'}</div>
            <div className="col-span-2">
              <span className="font-semibold">Maps Link:</span>{' '}
              {complaint.maps_link ? (
                <a
                  href={complaint.maps_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {complaint.maps_link}
                </a>
              ) : (
                'No Map Provided'
              )}
            </div>
          </div>

          {complaint.maps_link && (
            <a
              href={complaint.maps_link}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              View on Map
            </a>
          )}
        </div>

        {/* ✅ RIGHT SIDE — Chat Section */}
        <div className="bg-white rounded-lg shadow p-6 flex flex-col">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Chat for {complaint.formatted_id}
          </h2>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto border rounded-md p-3 mb-4 bg-gray-50 space-y-3">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-sm text-center">
                No messages yet.
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender === 'authority' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`px-3 py-2 rounded-lg text-sm max-w-[80%] ${
                      msg.sender === 'authority'
                        ? 'bg-green-100 text-green-900'
                        : 'bg-blue-100 text-blue-900'
                    }`}
                  >
                    <p>{msg.message}</p>
                    <span className="text-xs text-gray-500 block mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Send Message Box */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={sendMessage}
              disabled={sending}
              className={`px-4 py-2 rounded-md text-white ${
                sending
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}