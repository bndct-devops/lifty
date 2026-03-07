const base = '' // assumes hosting frontend and backend on same origin or using a proxy

// ── Auth wrapper ──
// Injects the Bearer token on every request and fires 'lifty:unauthorized'
// on any 401 so the app can redirect to the lock screen.

function authFetch(url, opts = {}) {
  const token = localStorage.getItem('liftyToken')
  const headers = { ...(opts.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(url, { ...opts, headers }).then(res => {
    if (res.status === 401) {
      window.dispatchEvent(new Event('lifty:unauthorized'))
    }
    return res
  })
}

// ── Instance auth ──

export async function authStatus() {
  const res = await authFetch(base + '/api/auth/status')
  return res.json()
}

export async function authLogin(password) {
  const res = await authFetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  return res.json()
}

export async function authChangePassword(currentPassword, newPassword) {
  const res = await authFetch(base + '/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
  return res.json()
}

// ── Profiles ──

export async function listProfiles() {
  const res = await authFetch(base + '/api/profiles')
  return res.json()
}

export async function createProfile(payload) {
  const res = await authFetch(base + '/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function getProfile(id) {
  const res = await authFetch(base + `/api/profiles/${id}`)
  return res.json()
}

export async function updateProfile(id, payload) {
  const res = await authFetch(base + `/api/profiles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function deleteProfile(id) {
  await authFetch(base + `/api/profiles/${id}`, { method: 'DELETE' })
}

// ── Exercises ──

export async function listExercises(profileId) {
  const q = profileId != null ? `?profile_id=${profileId}` : ''
  const res = await authFetch(base + `/api/exercises${q}`)
  return res.json()
}

export async function createExercise(payload) {
  const res = await authFetch(base + '/api/exercises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function updateExercise(id, payload) {
  const res = await authFetch(base + `/api/exercises/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function deleteExercise(id) {
  await authFetch(base + `/api/exercises/${id}`, { method: 'DELETE' })
}

// ── Workouts ──

export async function listWorkouts(profileId) {
  const q = profileId != null ? `?profile_id=${profileId}` : ''
  const res = await authFetch(base + `/api/workouts${q}`)
  return res.json()
}

export async function createWorkout(payload) {
  const res = await authFetch(base + '/api/workouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function startWorkout(id) {
  const res = await authFetch(base + `/api/workouts/${id}/start`, { method: 'POST' })
  return res.json()
}

export async function finishWorkout(id) {
  const res = await authFetch(base + `/api/workouts/${id}/finish`, { method: 'POST' })
  return res.json()
}

export async function updateWorkout(id, payload) {
  const res = await authFetch(base + `/api/workouts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function importStrong(file, profileId) {
  const form = new FormData()
  form.append('file', file)
  form.append('profile_id', profileId)
  const res = await authFetch(base + '/api/import/strong', { method: 'POST', body: form })
  return res.json()
}

export async function markRestDay(profileId) {
  const res = await authFetch(base + `/api/workouts/rest-day?profile_id=${profileId}`, { method: 'POST' })
  return res.json()
}

export async function deleteWorkout(id) {
  await authFetch(base + `/api/workouts/${id}`, { method: 'DELETE' })
}

export async function deleteAllWorkouts(profileId) {
  await authFetch(base + `/api/profiles/${profileId}/workouts`, { method: 'DELETE' })
}

export async function addSet(workoutId, payload) {
  const res = await authFetch(base + `/api/workouts/${workoutId}/sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function updateSet(workoutId, setId, payload) {
  const res = await authFetch(base + `/api/workouts/${workoutId}/sets/${setId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function deleteSet(workoutId, setId) {
  await authFetch(base + `/api/workouts/${workoutId}/sets/${setId}`, { method: 'DELETE' })
}

export async function reassignExercise(workoutId, oldExerciseId, newExerciseId) {
  const res = await authFetch(base + `/api/workouts/${workoutId}/reassign-exercise`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old_exercise_id: oldExerciseId, new_exercise_id: newExerciseId }),
  })
  return res.json()
}

export async function getWorkoutDetail(id) {
  const res = await authFetch(base + `/api/workouts/${id}`)
  return res.json()
}

export async function getExerciseLastSets(id) {
  const res = await authFetch(base + `/api/exercises/${id}/last_sets`)
  return res.json()
}

export async function getPRs(profileId) {
  const q = profileId != null ? `?profile_id=${profileId}` : ''
  const res = await authFetch(base + `/api/analytics/prs${q}`)
  return res.json()
}

export async function getDailyVolume(profileId) {
  const q = profileId != null ? `?profile_id=${profileId}` : ''
  const res = await authFetch(base + `/api/analytics/daily-volume${q}`)
  return res.json()
}

export async function getWeeklyVolume(profileId, weeks = 12) {
  const q = new URLSearchParams()
  if (profileId != null) q.set('profile_id', profileId)
  q.set('weeks', weeks)
  const res = await authFetch(base + `/api/analytics/weekly-volume?${q}`)
  return res.json()
}

export async function getMuscleGroups(profileId, weeks = 12) {
  const q = new URLSearchParams()
  if (profileId != null) q.set('profile_id', profileId)
  q.set('weeks', weeks)
  const res = await authFetch(base + `/api/analytics/muscle-groups?${q}`)
  return res.json()
}

export async function setPin(profileId, pin) {
  const res = await authFetch(base + `/api/profiles/${profileId}/set-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  return res.json()
}

export async function verifyPin(profileId, pin) {
  const res = await authFetch(base + `/api/profiles/${profileId}/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  return res.json()
}

export async function logBodyweight(profileId, weightKg, date) {
  const body = { weight_kg: weightKg }
  if (date) body.date = date
  const res = await authFetch(base + `/api/profiles/${profileId}/bodyweight`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function getBodyweight(profileId, limit = 90) {
  const res = await authFetch(base + `/api/profiles/${profileId}/bodyweight?limit=${limit}`)
  return res.json()
}

export async function deleteBodyweightEntry(profileId, entryId) {
  await authFetch(base + `/api/profiles/${profileId}/bodyweight/${entryId}`, { method: 'DELETE' })
}

export async function getExerciseHistory(exerciseId, profileId, limit = 30) {
  const q = new URLSearchParams()
  if (profileId != null) q.set('profile_id', profileId)
  q.set('limit', limit)
  const res = await authFetch(base + `/api/exercises/${exerciseId}/history?${q}`)
  return res.json()
}

// ── Web Push ──

export async function getPushVapidKey() {
  const res = await authFetch(base + '/api/push/vapid-public-key')
  const data = await res.json()
  return data.publicKey
}

export async function subscribePush(profileId) {
  if (!('PushManager' in window) || !navigator.serviceWorker) return false
  try {
    const publicKey = await getPushVapidKey()
    if (!publicKey) return false
    const reg = await navigator.serviceWorker.ready
    // Convert base64url to Uint8Array for applicationServerKey
    const padding = '='.repeat((4 - publicKey.length % 4) % 4)
    const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawKey = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: rawKey,
    })
    const json = sub.toJSON()
    await authFetch(base + '/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }),
    })
    return true
  } catch (e) {
    console.warn('[push] subscribe failed', e)
    return false
  }
}

export async function schedulePush(profileId, delayMs, title, body) {
  try {
    await authFetch(base + '/api/push/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, delayMs, title, body }),
    })
  } catch (_) {}
}

export async function cancelPush(profileId) {
  try {
    await authFetch(base + '/api/push/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId }),
    })
  } catch (_) {}
}
