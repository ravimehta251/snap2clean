// PeopleDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { lookupDistrictEmail } from '../districts.js'
import { createClient } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'

// --- Load EmailJS from CDN ---
const emailjsCdn = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js'
function useEmailJs(publicKey) {
  useEffect(() => {
    if (!publicKey) return
    const s = document.createElement('script')
    s.src = emailjsCdn
    s.async = true
    s.onload = () => {
      // eslint-disable-next-line no-undef
      emailjs.init({ publicKey })
    }
    document.body.appendChild(s)
    return () => document.body.removeChild(s)
  }, [publicKey])
}

// --- Location Utilities ---
async function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geo'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  })
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error('reverse geocode failed')
  const j = await res.json()
  const district = j?.address?.state_district || j?.address?.county || j?.address?.state || ''
  return { district, address: j?.display_name }
}

// --- Upload to ImgBB ---
const IMGBB_KEY = '76c8edaa0a93fcd7552a9243a82732dd'
async function uploadToImgbb(file) {
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: 'POST',
    body: fd
  })
  if (!res.ok) throw new Error('img upload failed')
  return await res.json()
}

// --- Supabase client ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// --- MAIN COMPONENT ---
export default function PeopleDashboard() {
  const navigate = useNavigate()

  const [serviceId] = useState('service_3ja5sr5')
  const [templateId] = useState('template_iejrc8b')
  const PUBLIC_KEY = 'y_ng38gqsTyNu7kKr'

  const [fromEmail, setFromEmail] = useState('')
  const [photo, setPhoto] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [district, setDistrict] = useState('')
  const [authorityEmail, setAuthorityEmail] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)
  const formRef = useRef(null)

  useEmailJs(PUBLIC_KEY)

  const mapsLink = useMemo(
    () => (lat && lon ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : ''),
    [lat, lon]
  )

  // --- Handle Image Selection ---
  function onPickPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setStatus('Select an image file'); e.target.value = ''; return }
    if (file.size > 5 * 1024 * 1024) { setStatus('Max 5MB image'); e.target.value = ''; return }
    setPhoto(file)
    setPreviewUrl(URL.createObjectURL(file))
    handleAutoLocation()
  }

  // --- Handle Location ---
  async function handleAutoLocation() {
    setStatus('Capturing GPS…')
    try {
      const { lat, lon } = await getBrowserLocation()
      setLat(lat.toFixed(6))
      setLon(lon.toFixed(6))
      setStatus('Resolving district…')
      const rev = await reverseGeocode(lat, lon)
      setDistrict(rev.district || '')
      const email = lookupDistrictEmail(rev.district || '')
      setAuthorityEmail(email)
      setStatus(email ? `District: ${rev.district} → ${email}` : `District: ${rev.district} (no email configured)`)
    } catch {
      setStatus('Location failed. Allow permission and try again.')
    }
  }

  // --- Handle Send Email & Save ---
  async function onSend(e) {
    e.preventDefault()
    if (!photo) { setStatus('Attach a photo'); return }
    if (!lat || !lon) { setStatus('Location missing'); return }
    if (!category) { setStatus('Select complaint category'); return }
    if (!description || !description.trim()) { setStatus('Description is required'); return }

    const recipient = authorityEmail || 'snap2clean@gmail.com'
    if (!recipient) { setStatus('No recipient email configured'); return }

    try {
      setSending(true)
      setStatus('Uploading photo…')

      // 1. Upload Image
      let imageUrl = ''
      try {
        const upload = await uploadToImgbb(photo)
        imageUrl = upload?.data?.display_url || upload?.data?.url || ''
      } catch (upErr) {
        console.error('ImgBB upload failed:', upErr)
      }

      if (!imageUrl) {
        setStatus('Image upload failed. Complaint not sent.')
        setSending(false)
        return
      }

      setStatus('Saving to database...')

      // 2. Save to Supabase
      const { data: dbData, error: dbError } = await supabase
        .from('complaints')
        .insert({
          from_email: fromEmail,
          latitude: lat,
          longitude: lon,
          district,
          category,
          description,
          maps_link: mapsLink,
          timestamp: new Date().toISOString(),
          image_url: imageUrl
        })
        .select('formatted_id')
        .single()

      if (dbError || !dbData) {
        console.error('Supabase insert error:', dbError)
        throw new Error(dbError?.message || 'Database save failed')
      }

      const complaintId = dbData.formatted_id
      setStatus(`Saved as ${complaintId}. Sending email...`)

      // 3. Prepare Email Variables
      const vars = {
        complaint_id: complaintId,
        from_email: fromEmail,
        latitude: lat,
        longitude: lon,
        category,
        district,
        description,
        maps_link: mapsLink,
        timestamp: new Date().toISOString(),
        image_url: imageUrl,
        image_html: `<img src="${imageUrl}" alt="Issue photo" style="max-width:600px; height:auto;" />`
      }

      if (!(globalThis.emailjs && typeof globalThis.emailjs.send === 'function')) {
        throw new Error('Email service not loaded.')
      }

      // 4. Send Email
      // eslint-disable-next-line no-undef
      await emailjs.send(serviceId, templateId, vars)

      // 5. Success
      setStatus(`Complaint ${complaintId} sent successfully!`)
      setFromEmail('')
      setDescription('')
      setCategory('')
      setPhoto(null)
      setPreviewUrl('')
    } catch (err) {
      console.error('Process failed:', err)
      if (err.message.includes('Email service') && status.includes('Saved as')) {
        setStatus(`${status.split('.')[0]}. Email failed to send.`)
      } else {
        setStatus(`Failed: ${err.message || 'unknown error'}`)
      }
    } finally {
      setSending(false)
    }
  }

  // --- UI Styling ---
  const inputStyle = "block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors"
  const readOnlyInputStyle = "block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-600 shadow-sm focus:outline-none"
  const baseButton = "w-full text-white rounded-md px-4 py-3 font-semibold shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
  const natureButton1 = `${baseButton} bg-green-700 hover:bg-green-800 focus:ring-green-600`
  const natureButton2 = `${baseButton} bg-lime-600 hover:bg-lime-700 focus:ring-lime-500`

  const getStatusClasses = () => {
    if (!status) return 'hidden'
    if (status.includes('Failed') || status.includes('failed') || status.includes('try again')) return 'bg-red-100 text-red-800'
    if (status.includes('successfully')) return 'bg-green-100 text-green-800'
    if (status.includes('no email configured')) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-50 text-green-700'
  }

  // --- UI Layout ---
  return (
    <div className="min-h-screen bg-emerald-50 text-gray-800 py-8 sm:py-12 px-4 font-sans">
      <div className="max-w-xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-lg border border-green-100">

        <h1 className="text-3xl font-bold text-green-800 mb-2 text-center">
          Snap2Clean
        </h1>
        <p className="text-base text-gray-600 mb-6 text-center">
          Report civic issues. Clean surroundings, green future.
        </p>

        {/* Email Input */}
        <div className="mb-6">
          <label htmlFor="fromEmail" className="block text-sm font-medium text-gray-700 mb-1">
            Your Email (Optional)
          </label>
          <input
            id="fromEmail"
            className={inputStyle}
            value={fromEmail}
            onChange={e => setFromEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <form ref={formRef} onSubmit={onSend} className="space-y-6">
          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Photo of the Issue</label>
            <label htmlFor="photo" className="w-full flex flex-col items-center px-4 py-5 bg-white border-2 border-green-300 border-dashed rounded-md shadow-sm cursor-pointer hover:bg-green-50 transition-colors">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              <span className="mt-2 text-sm text-green-700">{photo ? photo.name : 'Click or drag an image here (Max 5MB)'}</span>
              <span className="text-xs text-gray-500">This will also capture your location</span>
              <input id="photo" name="photo" type="file" className="sr-only" accept="image/*" capture="environment" onChange={onPickPhoto} />
            </label>
            {previewUrl && (<img src={previewUrl} alt="preview" className="w-full h-60 object-cover rounded-md border border-green-200 mt-4" />)}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Complaint Category <span className="text-red-600">*</span></label>
            <select id="category" value={category} onChange={e => setCategory(e.target.value)} className={inputStyle} required>
              <option value="">Select category</option>
              <option value="Dry Waste">Dry Waste</option>
              <option value="Wet Waste">Wet Waste</option>
              <option value="Medical Waste">Medical Waste</option>
              <option value="Pothole">Pothole</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-600">*</span></label>
            <textarea id="description" className={`${inputStyle} resize-none`} rows="3" placeholder="Describe the issue (e.g., garbage pile near school gate)" value={description} onChange={e => setDescription(e.target.value)} required></textarea>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label htmlFor="lat" className="block text-sm font-medium text-gray-700 mb-1">Latitude</label><input id="lat" className={readOnlyInputStyle} value={lat} readOnly placeholder="Latitude" /></div>
            <div><label htmlFor="lon" className="block text-sm font-medium text-gray-700 mb-1">Longitude</label><input id="lon" className={readOnlyInputStyle} value={lon} readOnly placeholder="Longitude" /></div>
            <div><label htmlFor="district" className="block text-sm font-medium text-gray-700 mb-1">District</label><input id="district" className={readOnlyInputStyle} value={district} readOnly placeholder="District" /></div>
            <div><label htmlFor="authEmail" className="block text-sm font-medium text-gray-700 mb-1">Authority Email</label><input id="authEmail" className={readOnlyInputStyle} value={authorityEmail} readOnly placeholder="Authority Email" /></div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button type="button" onClick={handleAutoLocation} className={natureButton1}>Refresh Location</button>
            <button type="submit" disabled={sending} className={natureButton2}>{sending ? 'Sending...' : 'Send Complaint'}</button>
          </div>
        </form>

        {status && <p className={`mt-5 text-center text-sm p-3 rounded-md ${getStatusClasses()}`}>{status}</p>}
        {mapsLink && <a className="block text-center text-sm text-green-700 hover:text-green-900 underline mt-4" href={mapsLink} target="_blank" rel="noreferrer">View on Google Maps</a>}

        {/* ✅ New Complaint Chat Button */}
        <div className="mt-10 text-center">
          <p className="text-sm text-gray-600 mb-3">
            Want to chat or check your complaint status?
          </p>
          <button
            onClick={() => navigate('/chat')}
            className="bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-600 transition-all duration-200"
          >
            Open Complaint Chat
          </button>
        </div>
      </div>
    </div>
  )
}
