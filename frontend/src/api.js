const base = '' // assumes hosting frontend and backend on same origin or using a proxy

// ── Profiles ──

export async function listProfiles() {
  const res = await fetch(base + '/api/profiles')
  return res.json()
}

export async function createProfile(payload) {
  const res = await fetch(base + '/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function getProfile(id) {
  const res = await fetch(base + `/api/profiles/${id}`)
  return res.json()
}

export async function updateProfile(id, payload) {
  const res = await fetch(base + `/api/profiles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function deleteProfile(id) {
  await fetch(base + `/api/profiles/${id}`, { method: 'DELETE' })
}

// ── Exercises ──

export async function listExercises(profileId) {
  const q = profileId != null ? `?profile_id=${profileId}` : ''
  const res = await fetch(base + `/api/exercises${q}`)
  return res.json()
}

export async function createExercise(payload) {
  const res = await fetch(base + '/api/exercises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function updateExercise(id, payload) {
  const res = await fetch(base + `/api/exercises/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

// ── Workouts ──

export async function listWorkouts(profileId) {
  const q = profileId != null ? `?profile_id=${profileId}` : ''
  const res = await fetch(base + `/api/workouts${q}`)
  return res.json()
}

export async function createWorkout(payload) {
  const res = await fetch(base + '/api/workouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function startWorkout(id) {
  const res = await fetch(base + `/api/workouts/${id}/start`, { method: 'POST' })
  return res.json()
}

export async function finishWorkout(id) {
  const res = await fetch(base + `/api/workouts/${id}/finish`, { method: 'POST' })
  return res.json()
}

export async function updateWorkout(id, payload) {
  const res = await fetch(base + `/api/workouts/${id}`, {
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
  const res = await fetch(base + '/api/import/strong', { method: 'POST', body: form })
  return res.json()
}

export async function markRestDay(profileId) {
  const res = await fetch(base + `/api/workouts/rest-day?profile_id=${profileId}`, { method: 'POST' })
  return res.json()
}

export async function deleteWorkout(id) {
  await fetch(base + `/api/workouts/${id}`, { method: 'DELETE' })
}

export async function deleteAllWorkouts(profileId) {
  await fetch(base + `/api/profiles/${profileId}/workouts`, { method: 'DELETE' })
}

export async function addSet(workoutId, payload) {
  const res = await fetch(base + `/api/workouts/${workoutId}/sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function updateSet(workoutId, setId, payload) {
  const res = await fetch(base + `/api/workouts/${workoutId}/sets/${setId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function deleteSet(workoutId, setId) {
  await fetch(base + `/api/workouts/${workoutId}/sets/${setId}`, { method: 'DELETE' })
}

export async function getWorkoutDetail(id) {
  const res = await fetch(base + `/api/workouts/${id}`)
  return res.json()
}

export async function getExerciseLastSets(id) {
  const res = await fetch(base + `/api/exercises/${id}/last_sets`)
  return res.json()
}

export async function getPRs(profileId) {
  const q = profileId != null ? `?profile_id=${profileId}` : ''
  const res = await fetch(base + `/api/analytics/prs${q}`)
  return res.json()
}

export async function getDailyVolume(profileId) {
  const q = profileId != null ? `?profile_id=${profileId}` : ''
  const res = await fetch(base + `/api/analytics/daily-volume${q}`)
  return res.json()
}

export async function getWeeklyVolume(profileId, weeks = 12) {
  const q = new URLSearchParams()
  if (profileId != null) q.set('profile_id', profileId)
  q.set('weeks', weeks)
  const res = await fetch(base + `/api/analytics/weekly-volume?${q}`)
  return res.json()
}

export async function getMuscleGroups(profileId, weeks = 12) {
  const q = new URLSearchParams()
  if (profileId != null) q.set('profile_id', profileId)
  q.set('weeks', weeks)
  const res = await fetch(base + `/api/analytics/muscle-groups?${q}`)
  return res.json()
}

export async function setPin(profileId, pin) {
  const res = await fetch(base + `/api/profiles/${profileId}/set-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  return res.json()
}

export async function verifyPin(profileId, pin) {
  const res = await fetch(base + `/api/profiles/${profileId}/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  return res.json()
}

export async function logBodyweight(profileId, weightKg, date) {
  const body = { weight_kg: weightKg }
  if (date) body.date = date
  const res = await fetch(base + `/api/profiles/${profileId}/bodyweight`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function getBodyweight(profileId, limit = 90) {
  const res = await fetch(base + `/api/profiles/${profileId}/bodyweight?limit=${limit}`)
  return res.json()
}

export async function deleteBodyweightEntry(profileId, entryId) {
  await fetch(base + `/api/profiles/${profileId}/bodyweight/${entryId}`, { method: 'DELETE' })
}

export async function getExerciseHistory(exerciseId, profileId, limit = 30) {
  const q = new URLSearchParams()
  if (profileId != null) q.set('profile_id', profileId)
  q.set('limit', limit)
  const res = await fetch(base + `/api/exercises/${exerciseId}/history?${q}`)
  return res.json()
}
