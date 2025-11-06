import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSignIn(e) {
    e.preventDefault()
    setError('')
    if (!email || !password) return setError('Provide email and password')
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('authorities')
        .select('id, name, email, password')
        .eq('email', email)
        .maybeSingle()

      if (error) throw error
      if (!data) return setError('No account found with that email')
      if (data.password !== password) return setError('Incorrect password')

      // store simple session and navigate
      localStorage.setItem('authority_email', data.email)
      localStorage.setItem('authority_name', data.name || '')
      navigate('/authority/dashboard')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Sign In</h2>
        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
        <form onSubmit={handleSignIn} className="space-y-4">
          <input className="block w-full border rounded px-3 py-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" className="block w-full border rounded px-3 py-2" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-green-700 text-white rounded-md">{loading ? 'Checking...' : 'Sign In'}</button>
            <button type="button" onClick={() => navigate('/authority')} className="flex-1 py-2 bg-gray-200 rounded-md">Back</button>
          </div>
        </form>
      </div>
    </div>
  )
}
