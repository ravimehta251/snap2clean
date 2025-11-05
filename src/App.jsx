import React, { useEffect, useMemo, useRef, useState } from 'react'
import { lookupDistrictEmail } from './districts.js'

// Load EmailJS in the browser from CDN and init with a public key
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

// Upload image to ImgBB and return the image URL
const IMGBB_KEY = '76c8edaa0a93fcd7552a9243a82732dd'
async function uploadToImgbb(file) {
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: 'POST',
    body: fd
  })
  if (!res.ok) throw new Error('img upload failed')
  return await res.json() // { data: { url, display_url, ... } }
}

// No backend; authority email is looked up locally

export default function App() {
  // EmailJS details (service/template prefilled), require only Public Key input
  const [serviceId] = useState('service_3ja5sr5')
  const [templateId] = useState('template_iejrc8b')
  const PUBLIC_KEY = 'y_ng38gqsTyNu7kKr'
  const [fromEmail, setFromEmail] = useState('ravi7481081raj@gmail.com')
  const [photo, setPhoto] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [district, setDistrict] = useState('')
  const [authorityEmail, setAuthorityEmail] = useState('')
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)
  const formRef = useRef(null)
  useEmailJs(PUBLIC_KEY)

  const mapsLink = useMemo(() => (lat && lon ? `https://maps.google.com/?q=${lat},${lon}` : ''), [lat, lon])

  function onPickPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setStatus('Select an image file'); e.target.value=''; return }
    if (file.size > 5 * 1024 * 1024) { setStatus('Max 5MB image'); e.target.value=''; return }
    setPhoto(file)
    setPreviewUrl(URL.createObjectURL(file))
    handleAutoLocation()
  }

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

  async function onSend(e) {
    e.preventDefault()
    if (!photo) { setStatus('Attach a photo'); return }
    if (!lat || !lon) { setStatus('Location missing'); return }
    const recipient = authorityEmail || 'ravi7481081raj@gmail.com'
    if (!recipient) { setStatus('No recipient email configured'); return }
    try {
      setSending(true); setStatus('Uploading photo…')
      let imageUrl = ''
      try {
        const upload = await uploadToImgbb(photo)
        imageUrl = upload?.data?.display_url || upload?.data?.url || ''
      } catch (upErr) {
        console.error('ImgBB upload failed:', upErr)
        // continue without image_url
      }

      setStatus('Sending…')
      const vars = {
        from_email: fromEmail,
        latitude: lat,
        longitude: lon,
        district,
        maps_link: mapsLink,
        timestamp: new Date().toISOString(),
        to_email: recipient,
        image_url: imageUrl
      }
      // eslint-disable-next-line no-undef
      await emailjs.send(serviceId, templateId, vars)
      setStatus('Complaint sent.')
    } catch (err) {
      console.error('Email send error:', err)
      const msg = err?.text || err?.message || 'unknown error'
      setStatus(`Send failed: ${msg}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2">Snap2Clean</h1>
      <p className="text-sm text-gray-600 mb-4">Click Photo to capture image and auto-fetch your location. We will determine the district and route the complaint.</p>

      <div className="rounded border p-3 mb-4 grid gap-2">
        <input className="border rounded px-2 py-1 w-full" value={fromEmail} onChange={e=>setFromEmail(e.target.value)} placeholder="Your email" />
      </div>

      <form ref={formRef} onSubmit={onSend} className="space-y-4">
        {/* Hidden fields required by EmailJS template and for dynamic recipient */}
        <input type="hidden" name="from_email" />
        <input type="hidden" name="latitude" />
        <input type="hidden" name="longitude" />
        <input type="hidden" name="district" />
        <input type="hidden" name="maps_link" />
        <input type="hidden" name="timestamp" />
        <input type="hidden" name="to_email" />
        <div>
          <label className="block text-sm font-medium mb-1">Photo</label>
          <input name="photo" type="file" accept="image/*" capture="environment" onChange={onPickPhoto} />
          {previewUrl && (
            <img src={previewUrl} alt="preview" className="w-full h-60 object-cover rounded border mt-2" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" value={lat} readOnly placeholder="Latitude" />
          <input className="border rounded px-3 py-2" value={lon} readOnly placeholder="Longitude" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" value={district} readOnly placeholder="District" />
          <input className="border rounded px-3 py-2" value={authorityEmail} readOnly placeholder="Authority Email" />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={handleAutoLocation} className="flex-1 bg-blue-600 text-white rounded px-4 py-2">Click Photo (Location)</button>
          <button type="submit" disabled={sending} className="flex-1 bg-green-600 text-white rounded px-4 py-2 disabled:opacity-60">Send Complaint</button>
        </div>
      </form>

      <p className={`mt-3 text-sm ${status.includes('failed')? 'text-red-700':'text-gray-800'}`}>{status}</p>
      {mapsLink && <a className="text-blue-600 text-sm underline" href={mapsLink} target="_blank" rel="noreferrer">View on Google Maps</a>}
    </div>
  )
}


