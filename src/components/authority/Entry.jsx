import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Entry() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Authority Access</h2>
        <p className="text-gray-600 mb-6">Sign in if you are an authorized official, or sign up to register.</p>
        <div className="grid gap-3">
          <button onClick={() => navigate('/authority/signin')} className="py-2 px-4 bg-green-700 text-white rounded-md">Sign In</button>
          <button onClick={() => navigate('/authority/signup')} className="py-2 px-4 bg-lime-600 text-white rounded-md">Sign Up</button>
        </div>
      </div>
    </div>
  )
}
