import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PeopleChat() {
  const [complaintIdInput, setComplaintIdInput] = useState('')
  const [complaintData, setComplaintData] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    return () => {
      // cleanup realtime channels if any
      // supabase.removeAllChannels && supabase.removeAllChannels()
    }
  }, [])

  async function fetchComplaintAndChat() {
    if (!complaintIdInput.trim()) return alert('Enter your Complaint ID (e.g. #00023)')
    setLoading(true)
    try {
      const { data: complaint, error: compError } = await supabase
        .from('complaints')
        .select('*')
        .eq('formatted_id', complaintIdInput.trim())
        .single()
      if (compError || !complaint) {
        alert('Complaint not found!')
        setComplaintData(null)
        setChatMessages([])
        setLoading(false)
        return
      }
      setComplaintData(complaint)

      const { data: chat, error: chatError } = await supabase
        .from('complaint_messages')
        .select('*')
        .eq('formatted_id', complaintIdInput.trim())
        .order('timestamp', { ascending: true })
      if (!chatError) setChatMessages(chat || [])

      // subscribe to new messages for this complaint
      const channel = supabase
        .channel('people_chat_live')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'complaint_messages',
          filter: `formatted_id=eq.${complaintIdInput.trim()}`,
        }, (payload) => {
          // reload messages (simple)
          setChatMessages((prev) => [...prev, payload.new])
        })
        .subscribe()

      // detach on unmount or next call
      return () => supabase.removeChannel(channel)
    } catch (err) {
      console.error('Error loading complaint/chat:', err)
    } finally {
      setLoading(false)
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim()) return
    if (!complaintIdInput.trim()) return alert('Enter a complaint ID first.')
    setSendingMsg(true)
    try {
      const { error } = await supabase.from('complaint_messages').insert([
        {
          formatted_id: complaintIdInput.trim(),
          sender: 'people',
          sender_email: 'anonymous',
          message: chatInput.trim(),
        },
      ])
      if (error) throw error
      setChatInput('')
      // append locally
      setChatMessages((prev) => [...prev, { message: chatInput.trim(), sender: 'people', timestamp: new Date().toISOString() }])
    } catch (err) {
      console.error('Chat send failed:', err)
      alert('Failed to send message')
    } finally {
      setSendingMsg(false)
    }
  }

  return (
    <div className="min-h-screen bg-emerald-50 text-gray-800 py-8 sm:py-12 px-4 font-sans">
      <div className="max-w-xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-lg border border-green-100">
        <h2 className="text-xl font-semibold mb-3">Track Your Complaint & Chat</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={complaintIdInput}
            onChange={(e) => setComplaintIdInput(e.target.value)}
            placeholder="Enter Complaint ID (e.g. #00023)"
            className="flex-1 border rounded-md px-3 py-2"
          />
          <button onClick={fetchComplaintAndChat} className="px-4 py-2 bg-green-600 text-white rounded-md">View</button>
        </div>

        {loading && <div className="text-sm text-gray-600">Loading complaint…</div>}

        {complaintData && (
          <div className="mb-4 bg-white rounded-md p-4 border shadow-sm">
            <p className="text-sm"><strong>ID:</strong> {complaintData.formatted_id}</p>
            <p className="text-sm"><strong>Status:</strong> {complaintData.status}</p>
            <p className="text-sm"><strong>Category:</strong> {complaintData.category}</p>
            <p className="italic mt-2">"{complaintData.description}"</p>
            {complaintData.image_url && <img src={complaintData.image_url} alt="Complaint" className="mt-3 w-full h-48 object-cover rounded-md border" />}
          </div>
        )}

        {complaintData && (
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Chat</h3>
            <div className="max-h-64 overflow-y-auto border rounded-md p-3 mb-3 bg-gray-50 space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">No messages yet.</p>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.sender === 'people' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-3 py-2 rounded-lg text-sm max-w-[80%] ${msg.sender === 'people' ? 'bg-green-100 text-green-900' : 'bg-blue-100 text-blue-900'}`}>
                      <p>{msg.message}</p>
                      <span className="text-xs text-gray-500 block mt-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 border rounded-md px-3 py-2 text-sm"
              />
              <button onClick={sendChatMessage} disabled={sendingMsg} className={`px-4 py-2 rounded-md text-white ${sendingMsg ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
// PeopleDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { lookupDistrictEmail } from '../districts.js'
import { createClient } from '@supabase/supabase-js'

// --- Supabase client ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// (Your existing EmailJS + location + complaint upload code remains unchanged)

// ------------------------------------------
// BELOW IS THE NEW COMPLAINT STATUS + CHAT SECTION
// ------------------------------------------

export default function PeopleDashboard() {
  // ... existing state and functions ...

  const [showStatusSection, setShowStatusSection] = useState(true)
  const [complaintIdInput, setComplaintIdInput] = useState('')
  const [complaintData, setComplaintData] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  // ✅ Fetch complaint details & chat by formatted_id
  async function fetchComplaintAndChat() {
    if (!complaintIdInput.trim()) return alert('Enter your Complaint ID (e.g. #00023)')

    try {
      // 1️⃣ Get complaint by formatted_id
      const { data: complaint, error: compError } = await supabase
        .from('complaints')
        .select('*')
        .eq('formatted_id', complaintIdInput.trim())
        .single()
      if (compError || !complaint) {
        alert('Complaint not found!')
        setComplaintData(null)
        setChatMessages([])
        return
      }
      setComplaintData(complaint)

      // 2️⃣ Fetch chat messages by formatted_id
      const { data: chat, error: chatError } = await supabase
        .from('complaint_messages')
        .select('*')
        .eq('formatted_id', complaintIdInput.trim())
        .order('timestamp', { ascending: true })
      if (!chatError) setChatMessages(chat || [])

      // 3️⃣ Subscribe for real-time chat
      const channel = supabase
        .channel('people_chat_live')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'complaint_messages',
            filter: `formatted_id=eq.${complaintIdInput.trim()}`,
          },
          () => fetchComplaintAndChat()
        )
        .subscribe()

      return () => supabase.removeChannel(channel)
    } catch (err) {
      console.error('Error loading complaint/chat:', err)
    }
  }

  // ✅ Send message (People Side)
  async function sendChatMessage() {
    if (!chatInput.trim()) return
    if (!complaintIdInput.trim()) return alert('Enter a complaint ID first.')
    setSendingMsg(true)
    try {
      const { error } = await supabase.from('complaint_messages').insert([
        {
          formatted_id: complaintIdInput.trim(),
          sender: 'people',
          sender_email: 'anonymous',
          message: chatInput.trim(),
        },
      ])
      if (error) throw error
      setChatInput('')
      fetchComplaintAndChat()
    } catch (err) {
      console.error('Chat send failed:', err)
    } finally {
      setSendingMsg(false)
    }
  }

  // --- UI Styling ---
  const inputStyle = "block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors"

  // --- Your existing complaint report UI remains unchanged ---
  // (Scroll down to the new part added below 👇)

  return (
    <div className="min-h-screen bg-emerald-50 text-gray-800 py-8 sm:py-12 px-4 font-sans">
      <div className="max-w-xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-lg border border-green-100">
        {/* existing complaint submission form ... */}
        {/* ... all your previous code remains here ... */}

        {/* ✅ New Complaint Status Section */}
        <hr className="my-8 border-t border-gray-200" />
        <div className="text-center mb-4">
          <button
            onClick={() => setShowStatusSection(!showStatusSection)}
            className="px-4 py-2 bg-green-700 text-white rounded-md shadow hover:bg-green-800 transition"
          >
            {showStatusSection ? 'Hide Complaint Status' : 'Complaint Status'}
          </button>
        </div>

        {showStatusSection && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-green-800 mb-3">
              Track Your Complaint
            </h2>

            {/* Input for Complaint ID added sum data*/}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={complaintIdInput}
                onChange={(e) => setComplaintIdInput(e.target.value)}
                placeholder="Enter Complaint ID (e.g. #00023)"
                className="flex-1 border rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={fetchComplaintAndChat}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                View
              </button>
            </div>

            {/* Show Complaint Info */}
            {complaintData && (
              <div className="mb-4 bg-white rounded-md p-4 border shadow-sm">
                <p className="text-sm text-gray-700">
                  <strong>Complaint ID:</strong> {complaintData.formatted_id}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Status:</strong>{' '}
                  <span
                    className={`px-2 py-1 rounded ${
                      complaintData.status === 'resolved'
                        ? 'bg-green-100 text-green-700'
                        : complaintData.status === 'processing'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {complaintData.status}
                  </span>
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Category:</strong> {complaintData.category}
                </p>
                <p className="text-sm text-gray-700 italic">
                  "{complaintData.description}"
                </p>
                {complaintData.image_url && (
                  <img
                    src={complaintData.image_url}
                    alt="Complaint"
                    className="mt-3 w-full h-48 object-cover rounded-md border"
                  />
                )}
              </div>
            )}

            {/* Chat Section */}
            {complaintData && (
              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Chat with Authority
                </h3>

                <div className="max-h-64 overflow-y-auto border rounded-md p-3 mb-3 bg-gray-50 space-y-3">
                  {chatMessages.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center">
                      No messages yet.
                    </p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.sender === 'people'
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        <div
                          className={`px-3 py-2 rounded-lg text-sm max-w-[80%] ${
                            msg.sender === 'people'
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

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={sendingMsg}
                    className={`px-4 py-2 rounded-md text-white ${
                      sendingMsg
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
