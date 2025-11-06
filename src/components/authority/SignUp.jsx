import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function SignUp() {
  const [name, setName] = useState('')
  const [authorityId, setAuthorityId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSignUp(e) {
    e.preventDefault()
    setError('')
    if (!name || !authorityId || !phone || !email || !password) return setError('Fill all fields')
    setLoading(true)
    try {
      const { data: existing } = await supabase
        .from('authorities')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existing) return setError('Account with this email already exists')

      const { data, error } = await supabase
        .from('authorities')
        .insert({ name, authority_id: authorityId, phone, email, password })
        .select('id')
        .single()

      if (error) throw error
      navigate('/authority/signin')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Sign-up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Sign Up</h2>
        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
        <form onSubmit={handleSignUp} className="space-y-4">
          <input className="block w-full border rounded px-3 py-2" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
          <input className="block w-full border rounded px-3 py-2" placeholder="Authority ID" value={authorityId} onChange={e => setAuthorityId(e.target.value)} />
          <input className="block w-full border rounded px-3 py-2" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
          <input className="block w-full border rounded px-3 py-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" className="block w-full border rounded px-3 py-2" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-lime-600 text-white rounded-md">{loading ? 'Creating...' : 'Create Account'}</button>
            <button type="button" onClick={() => navigate('/authority')} className="flex-1 py-2 bg-gray-200 rounded-md">Back</button>
          </div>
        </form>
      </div>
    </div>
  )
}
