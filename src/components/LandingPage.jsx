import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-400 via-green-300 to-lime-200">
      <div className="max-w-md w-full text-center p-8 rounded-xl bg-white/80 backdrop-blur-md shadow-xl">
        <h1 className="text-3xl font-bold text-green-900 mb-6">Welcome to Snap2Clean</h1>
        <p className="text-sm text-gray-700 mb-6">Choose an entry point to continue.</p>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => navigate('/authority')}
            className="transform transition duration-150 ease-in-out hover:scale-105 bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-md"
          >
            Authority
          </button>

          <button
            onClick={() => navigate('/people')}
            className="transform transition duration-150 ease-in-out hover:scale-105 bg-lime-600 hover:bg-lime-500 text-white font-semibold py-3 rounded-md"
          >
            People
          </button>
        </div>
      </div>
    </div>
  )
}
