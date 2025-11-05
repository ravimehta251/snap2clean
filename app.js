// Utility: local storage keys
const LS_KEYS = {
    serviceId: 's2c_emailjs_service',
    templateId: 's2c_emailjs_template',
    publicKey: 's2c_emailjs_public',
};

// Elements
const form = document.getElementById('reportForm');
const photoInput = document.getElementById('photo');
const photoPreviewWrap = document.getElementById('photoPreviewWrap');
const photoPreview = document.getElementById('photoPreview');
const captureBtn = document.getElementById('captureLocation');
const latEl = document.getElementById('latitude');
const lonEl = document.getElementById('longitude');
const mapsLinkEl = document.getElementById('maps_link');
const timestampEl = document.getElementById('timestamp');
const feedback = document.getElementById('feedback');
const sendBtn = document.getElementById('sendBtn');

// Settings modal
const settings = document.getElementById('settings');
const openSettings = document.getElementById('openSettings');
const closeSettings = document.getElementById('closeSettings');
const saveSettings = document.getElementById('saveSettings');
const svcInput = document.getElementById('svc');
const tplInput = document.getElementById('tpl');
const pkInput = document.getElementById('pk');

// Prefill service id if provided by user earlier
function hydrateSettingsUI() {
    svcInput.value = localStorage.getItem(LS_KEYS.serviceId) || '';
    tplInput.value = localStorage.getItem(LS_KEYS.templateId) || '';
    pkInput.value = localStorage.getItem(LS_KEYS.publicKey) || '';
}

function ensureEmailJsInit() {
    const pk = localStorage.getItem(LS_KEYS.publicKey) || '';
    if (!pk) return false;
    try {
        // idempotent init
        emailjs.init({ publicKey: pk });
        return true;
    } catch (e) {
        console.error('EmailJS init failed', e);
        return false;
    }
}

openSettings.addEventListener('click', () => {
    hydrateSettingsUI();
    settings.classList.remove('hidden');
    settings.classList.add('flex');
});

closeSettings.addEventListener('click', () => {
    settings.classList.add('hidden');
    settings.classList.remove('flex');
});

saveSettings.addEventListener('click', () => {
    localStorage.setItem(LS_KEYS.serviceId, svcInput.value.trim());
    localStorage.setItem(LS_KEYS.templateId, tplInput.value.trim());
    localStorage.setItem(LS_KEYS.publicKey, pkInput.value.trim());
    ensureEmailJsInit();
    settings.classList.add('hidden');
    settings.classList.remove('flex');
    toast('Settings saved.');
});

// Photo preview
photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) {
        photoPreviewWrap.classList.add('hidden');
        photoPreview.src = '';
        return;
    }
    if (!file.type.startsWith('image/')) {
        toast('Please select an image file.', true);
        photoInput.value = '';
        return;
    }
    // Limit ~5MB
    if (file.size > 5 * 1024 * 1024) {
        toast('Image too large (max 5 MB).', true);
        photoInput.value = '';
        return;
    }
    const url = URL.createObjectURL(file);
    photoPreview.src = url;
    photoPreviewWrap.classList.remove('hidden');
    setTimestampNow();
});

function setTimestampNow() {
    timestampEl.value = new Date().toISOString();
}

// Geolocation with IP fallback
const locStatus = document.getElementById('locStatus');

captureBtn.addEventListener('click', async () => {
    locStatus.textContent = 'Requesting high-accuracy location…';
    setTimestampNow();
    try {
        const coords = await getBrowserLocation({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
        setCoords(coords.latitude, coords.longitude, 'GPS');
    } catch (err) {
        locStatus.textContent = 'GPS denied/unavailable. Falling back to IP-based location…';
        try {
            const ip = await getIpLocation();
            setCoords(ip.latitude, ip.longitude, 'IP');
        } catch (e) {
            locStatus.textContent = 'Unable to determine location. Please try again or allow location access.';
        }
    }
});

function getBrowserLocation(options) {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) return reject(new Error('Geolocation unsupported'));
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => reject(err),
            options
        );
    });
}

async function getIpLocation() {
    // No-key basic IP API; accuracy is coarse
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error('IP geolocation failed');
    const data = await res.json();
    return { latitude: data.latitude, longitude: data.longitude };
}

function setCoords(lat, lon, source) {
    const latFixed = Number(lat).toFixed(6);
    const lonFixed = Number(lon).toFixed(6);
    latEl.value = latFixed;
    lonEl.value = lonFixed;
    mapsLinkEl.value = `https://maps.google.com/?q=${latFixed},${lonFixed}`;
    locStatus.textContent = `${source} location captured.`;
}

// Simple toast in feedback area
function toast(message, isError = false) {
    feedback.textContent = message;
    feedback.className = `mt-4 text-sm ${isError ? 'text-red-700' : 'text-green-700'}`;
}

// Submit logic via EmailJS sendForm (supports attachments)
let submitting = false;
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;

    const serviceId = localStorage.getItem(LS_KEYS.serviceId) || '';
    const templateId = localStorage.getItem(LS_KEYS.templateId) || '';
    const pk = localStorage.getItem(LS_KEYS.publicKey) || '';

    if (!serviceId || !templateId || !pk) {
        toast('Configure EmailJS settings first.', true);
        return;
    }

    if (!photoInput.files || photoInput.files.length === 0) {
        toast('Please attach a photo.', true);
        return;
    }

    if (!latEl.value || !lonEl.value) {
        toast('Please capture your location.', true);
        return;
    }

    try {
        ensureEmailJsInit();
        submitting = true;
        sendBtn.disabled = true;
        sendBtn.classList.add('opacity-60');
        toast('Sending report…');

        // Include maps_link and timestamp values in the form before sending
        if (!timestampEl.value) setTimestampNow();

        await emailjs.sendForm(serviceId, templateId, form);

        toast('Report sent successfully. Thank you!');
        // throttle: prevent rapid resubmissions for 5s
        setTimeout(() => {
            submitting = false;
            sendBtn.disabled = false;
            sendBtn.classList.remove('opacity-60');
        }, 5000);
        form.reset();
        photoPreviewWrap.classList.add('hidden');
        latEl.value = '';
        lonEl.value = '';
        mapsLinkEl.value = '';
        timestampEl.value = '';
        locStatus.textContent = '';
    } catch (err) {
        console.error(err);
        submitting = false;
        sendBtn.disabled = false;
        sendBtn.classList.remove('opacity-60');
        toast('Failed to send report. Please try again.', true);
    }
});

// Preload service id if user provided one earlier in chat
// The user mentioned service_3ja5sr5; we can prefill it
window.addEventListener('DOMContentLoaded', () => {
    const preset = 'service_3ja5sr5';
    if (!localStorage.getItem(LS_KEYS.serviceId)) {
        localStorage.setItem(LS_KEYS.serviceId, preset);
    }
    ensureEmailJsInit();
});


