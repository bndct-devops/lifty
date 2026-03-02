import React, { useEffect, useState, useTransition } from 'react'
import { listExercises, createExercise, updateExercise, deleteExercise, listWorkouts, createWorkout, updateWorkout, startWorkout, finishWorkout, deleteWorkout, deleteAllWorkouts, addSet, updateSet, deleteSet, getWorkoutDetail, getExerciseLastSets, getPRs, getDailyVolume, getWeeklyVolume, getMuscleGroups, listProfiles, createProfile, updateProfile, importStrong, markRestDay, setPin, verifyPin, logBodyweight, getBodyweight, deleteBodyweightEntry, getExerciseHistory, authStatus, authLogin, authChangePassword } from './api'
import { Dumbbell, Lock, ChevronLeft, ChevronRight, Eye, EyeOff, Trash2, Timer, CheckCircle2, Flame } from 'lucide-react'
import { fmtWeight, parseWeight, playDing, IconDownload, IconUpload, IconCheck, IconX, IconXCircle, MiniMarkdown } from './utils'
import BottomSheet from './BottomSheet'
import ActiveWorkoutView from './ActiveWorkoutView'

const THEMES = [
  { id: 'dark',                 label: 'Dark',         color: '#60a5fa' },
  { id: 'light',                label: 'Light',        color: '#3b82f6' },
  { id: 'amoled',               label: 'AMOLED',       color: '#1a1a1a' },
  { id: 'tokyo-night',          label: 'Tokyo Night',  color: '#7aa2f7' },
  { id: 'dracula',              label: 'Dracula',      color: '#bd93f9' },
  { id: 'nord',                 label: 'Nord',         color: '#88c0d0' },
  { id: 'gruvbox',              label: 'Gruvbox',      color: '#d79921' },
  { id: 'rose-pine',            label: 'Rosé Pine',    color: '#eb6f92' },
  { id: 'lifty',                 label: 'Lifty',        color: '#f5c2e7' },
  { id: 'catppuccin-mocha',     label: 'Mocha',        color: '#cba6f7' },
  { id: 'catppuccin-macchiato', label: 'Macchiato',    color: '#c6a0f6' },
  { id: 'catppuccin-frappe',    label: 'Frappé',       color: '#ca9ee6' },
  { id: 'catppuccin-latte',     label: 'Latte',        color: '#8839ef' },
]

const AVATAR_COLORS = ['#F9A8C9','#60a5fa','#cba6f7','#98c379','#e5c07b','#e06c75','#56b6c2','#abb2bf']

export default function App() {
  const [exercises, setExercises] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'home')
  const [animationsEnabled, setAnimationsEnabled] = useState(() => localStorage.getItem('animations') !== 'false')
  const [liquidGlass, setLiquidGlass] = useState(() => localStorage.getItem('liquidGlass') === 'true')
  const [navStyle, setNavStyle] = useState(() => localStorage.getItem('navStyle') || 'frosted')
  const [pendingTab, setPendingTab] = useState(null)
  const [, startTabTransition] = useTransition()
  const setTab = t => {
    localStorage.setItem('activeTab', t)
    setPendingTab(t)
    startTabTransition(() => {
      setActiveTab(t)
      setPendingTab(null)
    })
  }
  const [sessionWorkout, setSessionWorkout] = useState(null)
  const [timerStart, setTimerStart] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [activeProfile, setActiveProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [profileLoading, setProfileLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [pinSettingMode, setPinSettingMode] = useState(null) // 'set' | 'change' | null
  const [importState, setImportState] = useState(null) // null | 'loading' | {result}
  const [markingRestDay, setMarkingRestDay] = useState(false)
  const [sessionSets, setSessionSets] = useState([])
  const [celebrationData, setCelebrationData] = useState(null)
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(null)

  // ── Instance auth ──
  const [authEnabled, setAuthEnabled] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [backendError, setBackendError] = useState(false)
  const [lockError, setLockError] = useState('')
  const [lockPw, setLockPw] = useState('')
  const [lockLoading, setLockLoading] = useState(false)
  const [lockShowPw, setLockShowPw] = useState(false)
  const [pwChangeMode, setPwChangeMode] = useState(false)
  const [pwChangeCurrent, setPwChangeCurrent] = useState('')
  const [pwChangeNew, setPwChangeNew] = useState('')
  const [pwChangeError, setPwChangeError] = useState('')
  const [prs, setPrs] = useState([])
  const [prsLoaded, setPrsLoaded] = useState(false)
  const [volumeCache, setVolumeCache] = useState({})  // keyed by range: 'week' | 4 | 8 | 12 | 26
  const [muscleCache, setMuscleCache] = useState({})  // keyed by same range keys
  const [volumeMetric, setVolumeMetric] = useState('sets') // 'sets' | 'tonnage'
  const [progressRange, setProgressRange] = useState('week')  // 'week' | 4 | 8 | 12 | 26
  const [bwData, setBwData] = useState([])                     // [{id, weight_kg, date}]
  const [bwLoaded, setBwLoaded] = useState(false)
  const [bwInput, setBwInput] = useState('')
  const [bwSaving, setBwSaving] = useState(false)
  const [detailSheet, setDetailSheet] = useState(null) // { workout, detail } | null
  const [expandedExGroups, setExpandedExGroups] = useState(new Set())
  const [exFilterChip, setExFilterChip] = useState('')
  const [showTemplateSheet, setShowTemplateSheet] = useState(false)

  const BODY_PARTS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Full Body', 'Other']
  const EQUIPMENT = ['Bodyweight', 'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Kettlebell', 'Trap Bar', 'EZ Bar', 'TRX', 'Other']

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeProfile?.theme || 'lifty')
  }, [activeProfile?.theme])

  // ── Auth check on mount ──
  useEffect(() => {
    authStatus().then(({ auth_enabled }) => {
      setAuthEnabled(auth_enabled)
      if (!auth_enabled) {
        setIsAuthed(true)
      } else {
        // Optimistic: trust stored token; 401 listener will catch expired ones
        setIsAuthed(!!localStorage.getItem('liftyToken'))
      }
      setAuthChecked(true)
    }).catch(() => {
      // Server unreachable
      setBackendError(true)
      setAuthChecked(true)
    })
  }, [])

  // ── Listen for 401s from any API call ──
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem('liftyToken')
      setIsAuthed(false)
    }
    window.addEventListener('lifty:unauthorized', handler)
    return () => window.removeEventListener('lifty:unauthorized', handler)
  }, [])

  // Load profiles — only after auth is established and the user is authenticated
  useEffect(() => {
    if (!authChecked || !isAuthed) return
    const savedId = localStorage.getItem('activeProfileId')
    listProfiles().then(ps => {
      setProfiles(ps || [])
      if (savedId) {
        const found = (ps || []).find(p => p.id === Number(savedId))
        if (found) setActiveProfile(found)
      }
      setProfileLoading(false)
    }).catch(() => {
      setBackendError(true)
      setProfileLoading(false)
    })
  }, [authChecked, isAuthed])

  useEffect(() => {
    let id
    if (timerStart) {
      id = setInterval(() => setElapsed(Math.floor((Date.now() - timerStart) / 1000)), 1000)
    } else {
      setElapsed(0)
    }
    return () => clearInterval(id)
  }, [timerStart])

  useEffect(() => {
    if (activeTab === 'progress' && !prsLoaded && activeProfile) {
      getPRs(activeProfile.id).then(data => { setPrs(data || []); setPrsLoaded(true) })
    }
    if (activeTab === 'progress' && activeProfile) {
      if (volumeCache[progressRange] === undefined) {
        if (progressRange === 'week') {
          getDailyVolume(activeProfile.id).then(data => setVolumeCache(c => ({ ...c, week: data || [] })))
        } else {
          getWeeklyVolume(activeProfile.id, progressRange).then(data => setVolumeCache(c => ({ ...c, [progressRange]: data || [] })))
        }
      }
      if (muscleCache[progressRange] === undefined) {
        getMuscleGroups(activeProfile.id, progressRange === 'week' ? 1 : progressRange).then(data => setMuscleCache(c => ({ ...c, [progressRange]: data || [] })))
      }
    }
    if (activeTab === 'progress' && !bwLoaded && activeProfile) {
      getBodyweight(activeProfile.id).then(data => { setBwData(data || []); setBwLoaded(true) })
    }
  }, [activeTab, prsLoaded, volumeCache, muscleCache, bwLoaded, progressRange, activeProfile])

  const [exSearch, setExSearch] = useState('')
  const [deleteExercisePending, setDeleteExercisePending] = useState(null) // exercise object awaiting confirm
  const [editingExerciseId, setEditingExerciseId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editBodyPart, setEditBodyPart] = useState('')
  const [editEquipment, setEditEquipment] = useState('')

  useEffect(() => { if (activeProfile) fetchList() }, [activeProfile])

  async function fetchList() {
    if (!activeProfile) return
    const [ex, wo] = await Promise.all([listExercises(activeProfile.id), listWorkouts(activeProfile.id)])
    setExercises(ex || [])
    setWorkouts(wo || [])
    setVolumeCache({})
    setMuscleCache({})
    setBwLoaded(false)
  }

  function utcMs(s) { return s ? new Date(s.endsWith('Z') ? s : s + 'Z').getTime() : null }

  function startEditExercise(ex) {
    setEditingExerciseId(ex.id); setEditName(ex.name || ''); setEditDesc(ex.description || ''); setEditBodyPart(ex.body_part || ''); setEditEquipment(ex.equipment || '')
  }
  function cancelEditExercise() {
    setEditingExerciseId(null); setEditName(''); setEditDesc(''); setEditBodyPart(''); setEditEquipment('')
  }
  async function handleSaveExercise() {
    if (!editingExerciseId || !editName.trim()) return
    await updateExercise(editingExerciseId, { name: editName, description: editDesc, body_part: editBodyPart, equipment: editEquipment })
    cancelEditExercise(); fetchList()
  }
  async function handleDeleteExercise(ex) {
    setDeleteExercisePending(ex)
  }
  async function confirmDeleteExercise() {
    if (!deleteExercisePending) return
    await deleteExercise(deleteExercisePending.id)
    setDeleteExercisePending(null)
    fetchList()
  }

  async function handleStartNewWorkout(name) {
    const w = await createWorkout({ name, profile_id: activeProfile?.id })
    const started = await startWorkout(w.id)
    setWorkouts(ws => [...ws, started])
    setSessionWorkout(started); setTimerStart(utcMs(started.start_time)); setSessionSets([])
  }
  async function handleStartEmptyWorkout() {
    const h = new Date().getHours()
    const label = h >= 5 && h < 12 ? 'Morning' : h >= 12 && h < 17 ? 'Afternoon' : h >= 17 && h < 21 ? 'Evening' : 'Late Night'
    await handleStartNewWorkout(`${label} Workout`)
  }

  async function handleStartFromTemplate(templateWorkout) {
    setShowTemplateSheet(false)
    const detail = await getWorkoutDetail(templateWorkout.id)
    // Collect unique exercise IDs in the order they first appeared
    const seen = new Set()
    const orderedExIds = []
    for (const s of detail.sets) {
      if (!seen.has(s.exercise_id)) { seen.add(s.exercise_id); orderedExIds.push(s.exercise_id) }
    }
    const w = await createWorkout({ name: templateWorkout.name, profile_id: activeProfile?.id })
    const started = await startWorkout(w.id)
    const sets = []
    for (const exId of orderedExIds) {
      const s = await addSet(started.id, { exercise_id: exId, reps: null, weight: null })
      sets.push(s)
    }
    setWorkouts(ws => [...ws, started])
    setSessionWorkout(started)
    setTimerStart(utcMs(started.start_time))
    setSessionSets(sets)
  }
  async function handleStartWorkout(id) {
    const w = await startWorkout(id)
    setWorkouts(ws => ws.map(wo => wo.id === w.id ? w : wo))
    setSessionWorkout(w); setTimerStart(utcMs(w.start_time))
    const detail = await getWorkoutDetail(w.id); setSessionSets(detail.sets)
  }

  async function handleFinishWorkout(id) {
    try { await finishWorkout(id) } catch (e) { console.error('finish error', e) }
    const durationSecs = timerStart ? Math.floor((Date.now() - timerStart) / 1000) : 0
    const totalSets = sessionSets.length
    const uniqueEx = new Set(sessionSets.map(s => s.exercise_id)).size
    setCelebrationData({ workoutName: sessionWorkout?.name, durationSecs, totalSets, uniqueEx })
    setTimeout(() => setCelebrationData(null), 6000)
    setWorkouts(ws => ws.map(w => w.id === id ? { ...w, status: 'finished', set_count: totalSets } : w))
    setSessionWorkout(null); setTimerStart(null); setSessionSets([])
    setPrsLoaded(false)
    setVolumeLoaded(false)
    setDailyVolumeLoaded(false)
    setMuscleLoaded(false)
    setBwLoaded(false)
    fetchList()
  }

  async function handleCancelWorkout(id) {
    try { await deleteWorkout(id) } catch (e) { console.error('cancel error', e) }
    setWorkouts(ws => ws.filter(w => w.id !== id))
    setSessionWorkout(null); setTimerStart(null); setSessionSets([])
    fetchList()
  }

  async function handleOpenWorkout(id) {
    const d = await getWorkoutDetail(id)
    setSessionWorkout(d.workout); setSessionSets(d.sets)
    setTimerStart(d.workout.status === 'in_progress' ? utcMs(d.workout.start_time) : null)
  }

  async function handleAddSet(exId, reps, weight) {
    if (!sessionWorkout) return
    const newSet = await addSet(sessionWorkout.id, { exercise_id: exId, reps: reps ? Number(reps) : null, weight: weight ? Number(weight) : null })
    setSessionSets(prev => [...prev, newSet])
    return newSet
  }
  async function handleDeleteSet(workoutId, setId) {
    await deleteSet(workoutId, setId)
    setSessionSets(prev => prev.filter(s => s.id !== setId))
  }

  async function handleOpenDetail(w) {
    const d = await getWorkoutDetail(w.id)
    setDetailSheet({ workout: w, detail: d })
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  function parseDate(s) { return new Date((s || '').slice(0, 10) + 'T12:00') }
  function fmtDate(s, opts) { return parseDate(s).toLocaleDateString('default', opts) }

  const workoutsByDate = workouts.reduce((acc, w) => {
    const key = dateKey(parseDate(w.date))
    acc[key] = acc[key] || []; acc[key].push(w); return acc
  }, {})

  const monthStart = new Date()
  monthStart.setDate(1); monthStart.setMonth(monthStart.getMonth() + calendarMonthOffset)
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
  const calendarDays = []
  for (let i = 0; i < monthStart.getDay(); i++) calendarDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d)

  const searchTerm = exSearch.trim().toLowerCase()
  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = !searchTerm || ex.name.toLowerCase().includes(searchTerm) || (ex.description || '').toLowerCase().includes(searchTerm)
    const matchesBody = !exFilterChip || (ex.body_part || 'Other') === exFilterChip
    return matchesSearch && matchesBody
  })
  const exerciseGroups = filteredExercises.reduce((acc, ex) => {
    const key = ex.body_part || 'Other'; acc[key] = acc[key] || []; acc[key].push(ex); return acc
  }, {})
  const orderedGroups = [
    ...BODY_PARTS.filter(p => exerciseGroups[p]?.length),
    ...Object.keys(exerciseGroups).filter(k => !BODY_PARTS.includes(k)).sort(),
  ]
  function toggleExGroup(group) {
    setExpandedExGroups(prev => {
      const next = new Set(prev)
      next.has(group) ? next.delete(group) : next.add(group)
      return next
    })
  }

  function getWorkoutSummary(w) {
    let dur = '—'
    if (w.start_time && w.end_time) {
      const mins = Math.floor((new Date(w.end_time) - new Date(w.start_time)) / 60000)
      dur = `${mins} min`
    }
    return `${dur} · ${w.unique_exercises_count ?? 0} ex · ${w.set_count ?? 0} sets`
  }

  // Home screen derived data
  const todayKey = dateKey(new Date())
  const _wday = new Date().getDay() // 0=Sun,1=Mon,...
  const _weekOff = (activeProfile?.week_start || 'monday') === 'monday' ? (_wday + 6) % 7 : _wday
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - _weekOff); weekStart.setHours(0, 0, 0, 0)
  const thisWeekWorkouts = workouts.filter(w => w.status === 'finished' && parseDate(w.date) >= weekStart)
  const thisWeekSets = thisWeekWorkouts.reduce((s, w) => s + (w.set_count || 0), 0)
  const finishedDates = new Set(workouts.filter(w => w.status === 'finished').map(w => dateKey(parseDate(w.date))))
  let streak = 0
  const sd = new Date(); sd.setHours(0, 0, 0, 0)
  if (!finishedDates.has(dateKey(sd))) sd.setDate(sd.getDate() - 1)
  while (finishedDates.has(dateKey(sd))) { streak++; sd.setDate(sd.getDate() - 1) }
  const lastWorkout = [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date)).find(w => w.status === 'finished')
  const inProgress = workouts.find(w => w.status === 'in_progress')

  // Seed top-level timer from persisted start_time so the banner timer works after a page refresh
  useEffect(() => {
    if (inProgress?.start_time && !timerStart) {
      setTimerStart(utcMs(inProgress.start_time))
    }
  }, [inProgress?.start_time])  // eslint-disable-line react-hooks/exhaustive-deps

  // Progress tab: PR grouping
  const BODY_PART_ORDER = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body', 'Cardio', 'Other']
  const prsByPart = prs.reduce((acc, pr) => {
    const k = pr.body_part || 'Other'; acc[k] = acc[k] || []; acc[k].push(pr); return acc
  }, {})
  const prGroupKeys = [
    ...BODY_PART_ORDER.filter(p => prsByPart[p]?.length),
    ...Object.keys(prsByPart).filter(k => !BODY_PART_ORDER.includes(k)).sort(),
  ]

  // Weekly volume — replaced by /api/analytics/weekly-volume (see volumeData state)
  // Label helper for volume bars
  const fmtTonnage = (kg, unit) => {
    const v = unit === 'lbs' ? Math.round(kg * 2.20462) : Math.round(kg)
    return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)' }}>
        Loading…
      </div>
    )
  }

  if (backendError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>⚠️</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Can’t reach the backend</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 300 }}>The API server may still be starting up. Give it a moment and try again.</div>
        <button className="primary" style={{ marginTop: 8 }} onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  if (authEnabled && !isAuthed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, animation: 'flamePulse 3s ease-in-out infinite' }}>
            <Lock size={32} style={{ color: 'var(--accent)' }} strokeWidth={1.8} />
          </div>
          <h1 style={{ fontWeight: 900, fontSize: '2rem', margin: '0 0 6px', letterSpacing: '-0.03em', animation: 'celebrationPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>lifty</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 28px' }}>Enter password to continue</p>
          <div style={{ width: '100%', position: 'relative', marginBottom: lockError ? 8 : 20 }}>
            <input
              type={lockShowPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password"
              value={lockPw}
              onChange={e => { setLockPw(e.target.value); setLockError('') }}
              onKeyDown={e => e.key === 'Enter' && !lockLoading && (async () => {
                setLockLoading(true)
                const res = await authLogin(lockPw)
                setLockLoading(false)
                if (res.token) { localStorage.setItem('liftyToken', res.token); setIsAuthed(true); setLockPw('') }
                else setLockError(res.detail || 'Incorrect password')
              })()}
              style={{ width: '100%', padding: '14px 44px 14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '1rem', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
            />
            <button type="button" onClick={() => setLockShowPw(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              {lockShowPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {lockError && <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginBottom: 12, alignSelf: 'flex-start' }}>{lockError}</div>}
          <button
            className="primary"
            style={{ width: '100%', padding: '14px 0', borderRadius: 12, fontSize: '1rem', fontWeight: 700, opacity: lockLoading ? 0.6 : 1 }}
            disabled={lockLoading}
            onClick={async () => {
              setLockLoading(true)
              const res = await authLogin(lockPw)
              setLockLoading(false)
              if (res.token) { localStorage.setItem('liftyToken', res.token); setIsAuthed(true); setLockPw('') }
              else setLockError(res.detail || 'Incorrect password')
            }}>
            {lockLoading ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </div>
    )
  }

  if (profileLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)' }}>
        Loading…
      </div>
    )
  }

  if (!activeProfile) {
    return (
      <ProfileSelector
        profiles={profiles}
        onSelect={p => {
          localStorage.setItem('activeProfileId', p.id)
          setActiveProfile(p)
        }}
        onCreate={async name => {
          const p = await createProfile({ name, unit: 'kg', theme: 'lifty' })
          setProfiles(ps => [...ps, p])
          localStorage.setItem('activeProfileId', p.id)
          setActiveProfile(p)
        }}
      />
    )
  }

  if (sessionWorkout) {
    return (
      <ActiveWorkoutView
        workout={sessionWorkout}
        exercises={exercises}
        sessionSets={sessionSets}
        onFinish={handleFinishWorkout}
        onCancel={handleCancelWorkout}
        onExit={() => { setSessionWorkout(null); setSessionSets([]) }}
        onAddSet={handleAddSet}
        onDeleteSet={handleDeleteSet}
        onRename={async (id, name) => {
          const updated = await updateWorkout(id, { name })
          if (updated?.id) {
            setSessionWorkout(sw => ({ ...sw, name: updated.name }))
            setWorkouts(ws => ws.map(w => w.id === id ? { ...w, name: updated.name } : w))
          }
        }}
        onSaveNotes={async (id, notes) => {
          const updated = await updateWorkout(id, { notes })
          if (updated?.id) {
            setSessionWorkout(sw => ({ ...sw, notes: updated.notes }))
            setWorkouts(ws => ws.map(w => w.id === id ? { ...w, notes: updated.notes } : w))
          }
        }}
        elapsed={elapsed}
        unit={activeProfile.unit || 'kg'}
        restDuration={activeProfile.rest_duration || 90}
        dingEnabled={activeProfile.ding_enabled !== false}
        overloadHints={activeProfile.overload_hints !== false}
        plateCalc={activeProfile.plate_calculator !== false}
        prs={prs}
        onRestDurationChange={async d => {
          const updated = await updateProfile(activeProfile.id, { rest_duration: d })
          setActiveProfile(prev => ({ ...prev, rest_duration: updated.rest_duration }))
        }}
        liquidGlass={liquidGlass}
        animationsEnabled={animationsEnabled}
      />
    )
  }

  return (
    <div className={['app', animationsEnabled ? '' : 'no-anim', liquidGlass ? 'liquid-glass' : ''].filter(Boolean).join(' ')}>

      {/* ── Finish celebration overlay ── */}
      {celebrationData && (
        <div onClick={() => setCelebrationData(null)}
          className="glass-overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="glass-panel" style={{ borderRadius: 20, padding: '36px 28px', textAlign: 'center', maxWidth: 340, width: '100%', animation: 'celebrationPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
            onClick={e => e.stopPropagation()}>
            <CheckCircle2 size={52} style={{ color: 'var(--accent)', marginBottom: 14 }} strokeWidth={1.8} />
            <div style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: 4 }}>Workout done!</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>{celebrationData.workoutName}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
              <div><div style={{ fontWeight: 800, fontSize: '1.6rem', fontVariantNumeric: 'tabular-nums' }}>{Math.floor(celebrationData.durationSecs / 60)}<span style={{ fontSize: '0.9rem', fontWeight: 600 }}>m</span></div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>duration</div></div>
              <div><div style={{ fontWeight: 800, fontSize: '1.6rem' }}>{celebrationData.totalSets}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>sets</div></div>
              <div><div style={{ fontWeight: 800, fontSize: '1.6rem' }}>{celebrationData.uniqueEx}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>exercises</div></div>
            </div>
            <button onClick={() => setCelebrationData(null)}
              style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>Nice!</button>
          </div>
        </div>
      )}

      <header className="top">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          lifty
          <Dumbbell size={22} strokeWidth={1.8} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        </h1>
        <button type="button" onClick={() => setShowSettings(true)}
          style={{ width: 36, height: 36, borderRadius: '50%', background: activeProfile.avatar_color || 'var(--accent)', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1rem', flexShrink: 0, fontFamily: 'inherit' }}>
          {activeProfile.name.charAt(0).toUpperCase()}
        </button>
      </header>

      <main className="content">
        {/* ─── HOME ─── */}
        {activeTab === 'home' && (
          <section style={{ animation: 'tabFadeIn 0.18s ease both' }}>
            {inProgress && (() => {
              const h = Math.floor(elapsed / 3600)
              const m = Math.floor((elapsed % 3600) / 60)
              const s = elapsed % 60
              const timerStr = h > 0
                ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
                : `${m}:${String(s).padStart(2,'0')}`
              const timerColor = elapsed >= 7200 ? 'var(--danger)' : elapsed >= 5400 ? 'var(--warning)' : 'var(--text-muted)'
              return (
                <div className="card" style={{ border: '2px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <p className="section-heading" style={{ color: 'var(--accent)', margin: 0 }}>Workout in Progress</p>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.9rem', color: timerColor, fontWeight: 500, transition: 'color 2s ease' }}><Timer size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{timerStr}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginTop: 8 }}>{inProgress.name}</div>
                  <div className="muted small" style={{ margin: '4px 0 12px' }}>{(inProgress.unique_exercises_count ?? 0)} ex · {(inProgress.set_count ?? 0)} sets</div>
                  <button className="primary" style={{ width: '100%' }} onClick={() => handleOpenWorkout(inProgress.id)}>Continue →</button>
                </div>
              )
            })()}

            <button className="primary start-btn" onClick={handleStartEmptyWorkout}>Start New Workout</button>
            {workouts.some(w => w.status === 'finished') && (
              <button onClick={() => setShowTemplateSheet(true)}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Use template
              </button>
            )}

            {(() => {
              const todayRestDay = workouts.find(w => w.is_rest_day && dateKey(parseDate(w.date)) === todayKey)
              const todayHasWorkout = workouts.some(w => !w.is_rest_day && w.status === 'finished' && dateKey(parseDate(w.date)) === todayKey)
              if (todayHasWorkout || inProgress) return null
              return (
                <button onClick={async () => {
                  if (todayRestDay || markingRestDay) return
                  setMarkingRestDay(true)
                  const r = await markRestDay(activeProfile.id)
                  if (r?.id) setWorkouts(ws => [...ws.filter(w => w.id !== r.id), r])
                  setMarkingRestDay(false)
                }} style={{ width: '100%', padding: '14px', borderRadius: 12, border: todayRestDay ? '1px solid color-mix(in srgb, var(--success) 40%, transparent)' : '1px solid color-mix(in srgb, var(--success) 35%, transparent)', background: todayRestDay ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--success) 7%, transparent)', color: todayRestDay ? 'var(--success)' : 'color-mix(in srgb, var(--success) 80%, var(--text-muted))', fontWeight: 600, fontSize: '0.9rem', cursor: todayRestDay ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {todayRestDay ? <><IconCheck size={14} />Rest day logged</> : markingRestDay ? 'Logging…' : 'Mark as rest day'}
                </button>
              )
            })()}

            <div className="card">
              <p className="section-heading">This Week</p>
              <div className="stat-row">
                <div className="stat-box"><span className="stat-num">{thisWeekWorkouts.length}</span><span className="stat-label">workouts</span></div>
                <div className="stat-box"><span className="stat-num">{thisWeekSets}</span><span className="stat-label">sets</span></div>
                <div className="stat-box" style={streak >= 3 ? { background: 'color-mix(in srgb, #f97316 12%, var(--bg-secondary))', borderColor: 'color-mix(in srgb, #f97316 30%, transparent)' } : {}}><span className="stat-num" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>{streak >= 3 && <Flame size={17} style={{ color: '#f97316', animation: 'flamePulse 1.2s ease-in-out infinite', flexShrink: 0 }} />}{streak}</span><span className="stat-label">day streak</span></div>
              </div>
            </div>

            {lastWorkout && (
              <div className="card">
                <p className="section-heading">Last Workout</p>
                <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{lastWorkout.name}</div>
                <div className="muted small" style={{ margin: '4px 0 12px' }}>
                  {fmtDate(lastWorkout.date, { weekday: 'long', month: 'short', day: 'numeric' })} · {getWorkoutSummary(lastWorkout)}
                </div>
                <button onClick={() => handleOpenDetail(lastWorkout)} style={{ width: '100%' }}>View</button>
              </div>
            )}

            {workouts.filter(w => w.status === 'finished' && w.id !== lastWorkout?.id).length > 0 && (
              <div className="card">
                <p className="section-heading">Recent</p>
                <ul className="list">
                  {[...workouts].sort((a, b) => new Date(b.date) - new Date(a.date)).filter(w => w.status === 'finished' && w.id !== lastWorkout?.id).slice(0, 4).map(w => (
                    <li key={w.id} style={{ cursor: 'pointer' }} onClick={() => handleOpenDetail(w)}>
                      <div style={{ fontWeight: 600 }}>{w.name}</div>
                      <div className="muted small">{fmtDate(w.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {getWorkoutSummary(w)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* ─── EXERCISES ─── */}
        {activeTab === 'exercises' && (
          <section style={{ animation: 'tabFadeIn 0.18s ease both' }}>
            {/* Search bar */}
            <div className="card" style={{ paddingBottom: 14 }}>
              <input
                placeholder="Search exercises…"
                value={exSearch}
                onChange={e => setExSearch(e.target.value)}
                style={{ marginBottom: 10 }}
              />
              {/* Body-part chip filter */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {BODY_PARTS.map(p => (
                  <button key={p} type="button"
                    onClick={() => setExFilterChip(c => c === p ? '' : p)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600,
                      border: exFilterChip === p ? 'none' : '1px solid var(--border)',
                      background: exFilterChip === p ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: exFilterChip === p ? '#fff' : 'var(--muted)',
                      cursor: 'pointer',
                    }}>{p}</button>
                ))}
              </div>
            </div>

            {/* Collapsible group list */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {orderedGroups.length === 0
                ? <p className="muted" style={{ padding: 18 }}>No exercises match</p>
                : orderedGroups.map((group, gi) => {
                  const isOpen = expandedExGroups.has(group)
                  const count = exerciseGroups[group].length
                  return (
                    <div key={group} style={{ borderBottom: gi < orderedGroups.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      {/* Group header — tap to expand/collapse */}
                      <button
                        type="button"
                        onClick={() => toggleExGroup(group)}
                        style={{
                          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{group}</span>
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{count} {isOpen ? '▲' : '▼'}</span>
                      </button>
                      {/* Exercise list — visible when open */}
                      {isOpen && (
                        <ul className="list" style={{ margin: 0, padding: '0 18px' }}>
                          {exerciseGroups[group].map(ex => (
                            <li key={ex.id} style={{ padding: '10px 0' }}>
                              {editingExerciseId === ex.id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}>
                                  <input value={editName} onChange={e => setEditName(e.target.value)} />
                                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description (optional)" />
                                  <select value={editBodyPart} onChange={e => setEditBodyPart(e.target.value)}>
                                    <option value="">Body part (optional)</option>
                                    {BODY_PARTS.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                  <select value={editEquipment} onChange={e => setEditEquipment(e.target.value)}>
                                    <option value="">Equipment (optional)</option>
                                    {EQUIPMENT.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                                  </select>
                                  <div className="row">
                                    <button type="button" onClick={cancelEditExercise}>Cancel</button>
                                    <button type="button" className="primary" onClick={handleSaveExercise}>Save</button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600 }}>{ex.name}</div>
                                    {ex.equipment ? <div className="muted small">{ex.equipment}</div> : null}
                                  </div>
                                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    <button type="button" onClick={() => startEditExercise(ex)}
                                      style={{ background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.02em', fontFamily: 'inherit' }}
                                      aria-label="Edit">Edit</button>
                                    {ex.profile_id != null && (
                                      <button type="button" onClick={() => handleDeleteExercise(ex)}
                                        style={{ background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.02em', fontFamily: 'inherit' }}
                                        aria-label="Delete">Delete</button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
            </div>

            {/* Add new exercise — collapsed behind a button by default */}
            <AddExerciseForm
              BODY_PARTS={BODY_PARTS}
              EQUIPMENT={EQUIPMENT}
              onAdd={async (payload) => { await createExercise({ ...payload, profile_id: activeProfile?.id }); fetchList() }}
            />
          </section>
        )}

        {/* ─── HISTORY ─── */}
        {activeTab === 'history' && (
          <section style={{ animation: 'tabFadeIn 0.18s ease both' }}>
            {workouts.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: '2.8rem', marginBottom: 14 }}>📋</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>No workouts yet</div>
                <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>Finish your first workout to see it here.</p>
              </div>
            ) : (<>
            {/* Calendar filter */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <button onClick={() => setCalendarMonthOffset(calendarMonthOffset - 1)} style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }}><ChevronLeft size={18} /></button>
                <p className="section-heading" style={{ margin: 0 }}>{monthStart.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                <button onClick={() => setCalendarMonthOffset(calendarMonthOffset + 1)} style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }}><ChevronRight size={18} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="muted small" style={{ textAlign: 'center', paddingBottom: 4, fontWeight: 600 }}>{d}</div>
                ))}
                {calendarDays.map((day, idx) => {
                  if (!day) return <div key={`e-${idx}`} />
                  const key = dateKey(new Date(monthStart.getFullYear(), monthStart.getMonth(), day))
                  const count = (workoutsByDate[key] || []).length
                  const isSelected = selectedDate === key
                  const isToday = key === todayKey
                  return (
                    <button key={key} onClick={() => setSelectedDate(isSelected ? null : key)}
                      style={{
                        padding: '6px 2px', borderRadius: 8, textAlign: 'center', border: 'none',
                        outline: isSelected ? '2px solid var(--accent)' : isToday ? '1px solid var(--accent)' : 'none',
                        background: isSelected ? 'var(--accent)' : count ? 'var(--bg-secondary)' : 'transparent',
                        color: isSelected ? '#fff' : 'var(--text)',
                        minHeight: 40, cursor: 'pointer',
                      }}>
                      <div style={{ fontWeight: isToday ? 700 : 400, fontSize: '0.9rem' }}>{day}</div>
                      {count ? <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : 'var(--accent)', margin: '2px auto 0' }} /> : null}
                    </button>
                  )
                })}
              </div>
              {selectedDate && (
                <button onClick={() => setSelectedDate(null)} style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.82rem', textDecoration: 'underline', padding: 0 }}>
                  Clear filter
                </button>
              )}
            </div>

            {/* Workout list — filtered by selected day, or all */}
            <div className="card">
              {selectedDate && (
                <p className="section-heading" style={{ marginTop: 0 }}>
                  {new Date(selectedDate + 'T12:00').toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              )}
              {(() => {
                const list = selectedDate
                  ? (workoutsByDate[selectedDate] || [])
                  : [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date))
                if (list.length === 0) return <p className="muted">{selectedDate ? 'No workouts on this day.' : 'No workouts yet.'}</p>
                return (
                  <ul className="list">
                    {list.map((w, idx) => (
                      <li key={w.id} style={{ padding: '14px 0', animation: 'slideUp 0.32s ease both', animationDelay: `${Math.min(idx, 10) * 50}ms` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{w.name}</div>
                            {!selectedDate && <div className="muted small" style={{ marginTop: 2 }}>{fmtDate(w.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                            <div className="muted small" style={{ marginTop: 3 }}>{getWorkoutSummary(w)}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                            {w.status === 'finished' && (
                              <button onClick={() => handleOpenDetail(w)} style={{ fontSize: '0.8rem', padding: '4px 12px' }}>View</button>
                            )}
                            {w.status === 'in_progress' && <button onClick={() => handleOpenWorkout(w.id)} className="primary" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>Continue →</button>}
                            {w.status === 'not_started' && <button onClick={() => handleStartWorkout(w.id)} className="primary" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>Start</button>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </div>
            </>)}
          </section>
        )}

        {/* ─── PROGRESS ─── */}
        {activeTab === 'progress' && (
          <section style={{ animation: 'tabFadeIn 0.18s ease both' }}>
            {/* Activity heatmap */}
            <div className="card">
              <p className="section-heading">Activity — last 26 weeks</p>
              {(() => {
                const cellSize = 10, gap = 2, cols = 26
                const todayD = new Date(); todayD.setHours(0,0,0,0)
                const gridStart = new Date(todayD)
                gridStart.setDate(gridStart.getDate() - (cols * 7 - 1))
                const dow = (gridStart.getDay() + 6) % 7
                gridStart.setDate(gridStart.getDate() - dow)
                const dayMap = {}
                workouts.forEach(w => {
                  const key = dateKey(parseDate(w.date))
                  if (w.is_rest_day) { if (!dayMap[key]) dayMap[key] = 'rest' }
                  else if (w.status === 'finished') dayMap[key] = 'workout'
                })
                const totalW = cols * (cellSize + gap) - gap
                const totalH = 7 * (cellSize + gap) - gap
                const todayKey2 = dateKey(todayD)
                const cells = []
                for (let col = 0; col < cols; col++) {
                  for (let row = 0; row < 7; row++) {
                    const d = new Date(gridStart)
                    d.setDate(d.getDate() + col * 7 + row)
                    const key = dateKey(d)
                    const isFuture = d > todayD
                    const isToday = key === todayKey2
                    const entry = isFuture ? null : dayMap[key]
                    const fill = entry === 'workout' ? 'var(--accent)' : entry === 'rest' ? 'var(--success)' : 'var(--bg-secondary)'
                    cells.push(<rect key={`${col}-${row}`} x={col*(cellSize+gap)} y={row*(cellSize+gap)} width={cellSize} height={cellSize} rx={2} fill={fill} opacity={isFuture ? 0.15 : 1} stroke={isToday ? 'var(--text)' : 'none'} strokeWidth={1.5} />)
                  }
                }
                return (
                  <div>
                    <svg width="100%" viewBox={`0 0 ${totalW} ${totalH}`} style={{ display: 'block' }}>{cells}</svg>
                    <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }}/>Workout</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--success)' }}/>Rest day</div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Bodyweight log */}
            <div className="card">
              <p className="section-heading">Body Weight</p>
              <form onSubmit={async e => {
                e.preventDefault()
                const n = parseFloat(bwInput)
                if (isNaN(n) || n <= 0) return
                setBwSaving(true)
                const kg = activeProfile.unit === 'lbs' ? Math.round(n / 2.20462 * 100) / 100 : n
                await logBodyweight(activeProfile.id, kg)
                const fresh = await getBodyweight(activeProfile.id)
                setBwData(fresh || [])
                setBwInput('')
                setBwSaving(false)
              }} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input
                  type="number" inputMode="decimal" step="0.1" min="20" max="500"
                  placeholder={`Today's weight (${activeProfile.unit})`}
                  value={bwInput}
                  onChange={e => setBwInput(e.target.value)}
                  style={{ marginBottom: 0, flex: 1 }}
                />
                <button type="submit" className="primary" disabled={bwSaving || !bwInput} style={{ whiteSpace: 'nowrap' }}>
                  {bwSaving ? '…' : 'Log'}
                </button>
              </form>
              {!bwLoaded ? <p className="muted">Loading…</p> : bwData.length < 2 ? (
                <p className="muted small">Log at least 2 entries to see a chart.</p>
              ) : (() => {
                const entries = [...bwData].sort((a, b) => new Date(a.date) - new Date(b.date))
                const toDisp = w => activeProfile.unit === 'lbs' ? Math.round(w * 2.20462 * 10) / 10 : w
                const weights = entries.map(e => toDisp(e.weight_kg))
                const minW = Math.min(...weights), maxW = Math.max(...weights)
                const range = maxW - minW || 0.1
                const W = 320, H = 72, padL = 4, padR = 4, padT = 18, padB = 20
                const n = entries.length
                const xs = entries.map((_, i) => padL + (n === 1 ? (W - padL - padR) / 2 : i / (n - 1) * (W - padL - padR)))
                const ys = weights.map(w => padT + (1 - (w - minW) / range) * H)
                const polyline = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
                const fillPoly = `${xs[0].toFixed(1)},${(padT + H).toFixed(1)} ${polyline} ${xs[n-1].toFixed(1)},${(padT + H).toFixed(1)}`
                function fmtD(d) { return new Date(d.endsWith('Z') ? d : d + 'Z').toLocaleDateString('default', { month: 'short', day: 'numeric' }) }
                const labelIdxs = [0, Math.floor(n / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i)
                return (
                  <div>
                    <svg width="100%" viewBox={`0 0 ${W} ${padT + H + padB}`} style={{ display: 'block', marginBottom: 10 }}>
                      <line x1={padL} y1={padT + H} x2={W - padR} y2={padT + H} stroke="var(--border)" strokeWidth="0.8" />
                      <polyline points={fillPoly} fill="var(--accent)" opacity="0.1" />
                      <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      {xs.map((x, i) => (
                        <circle key={i} cx={x} cy={ys[i]} r={i === n - 1 ? 3 : 2}
                          fill={i === n - 1 ? 'var(--accent)' : 'var(--bg-secondary)'}
                          stroke={i === n - 1 ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth="1" />
                      ))}
                      <text x={xs[n-1]} y={ys[n-1] - 6} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--accent)">{weights[n-1]}</text>
                      {labelIdxs.map((idx, i) => (
                        <text key={idx} x={xs[idx]} y={padT + H + padB - 2}
                          textAnchor={i === 0 ? 'start' : i === labelIdxs.length - 1 ? 'end' : 'middle'}
                          fontSize="8" fill="var(--muted)">{fmtD(entries[idx].date)}</text>
                      ))}
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {[...entries].reverse().slice(0, 5).map(entry => (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtD(entry.date)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{toDisp(entry.weight_kg)} {activeProfile.unit}</span>
                            <button type="button" onClick={async () => {
                              await deleteBodyweightEntry(activeProfile.id, entry.id)
                              setBwData(d => d.filter(x => x.id !== entry.id))
                            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}><IconX size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Range selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              {[['week','Week'],[4,'4w'],[8,'8w'],[12,'12w'],[26,'26w']].map(([w, label]) => (
                <button key={w} type="button"
                  onClick={() => setProgressRange(w)}
                  style={{ padding: '4px 12px', borderRadius: 6, border: progressRange === w ? '2px solid var(--accent)' : '1px solid var(--border)', background: progressRange === w ? 'var(--accent)' : 'transparent', color: progressRange === w ? '#fff' : 'var(--text)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            {/* Volume chart */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <p className="section-heading" style={{ margin: 0 }}>Volume — {progressRange === 'week' ? 'this week' : `last ${progressRange}w`}</p>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['sets', 'Sets'], ['tonnage', 'Tonnage']].map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setVolumeMetric(val)}
                      style={{ padding: '3px 10px', borderRadius: 6, border: volumeMetric === val ? '2px solid var(--accent)' : '1px solid var(--border)', background: volumeMetric === val ? 'var(--accent)' : 'transparent', color: volumeMetric === val ? '#fff' : 'var(--text)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="muted small" style={{ marginTop: 4, marginBottom: 16 }}>
                {progressRange === 'week'
                  ? (volumeMetric === 'sets' ? 'Sets per day this week' : `Tonnage per day this week (${activeProfile.unit})`)
                  : (volumeMetric === 'sets' ? 'Sets completed per week' : `Total weight moved per week (${activeProfile.unit})`)}
              </p>
              {volumeCache[progressRange] === undefined ? (
                <p className="muted">Loading…</p>
              ) : (() => {
                const chartData = volumeCache[progressRange]
                const barW = 36, gap = 6, H = 100
                const values = chartData.map(w =>
                  volumeMetric === 'sets' ? w.sets
                  : (activeProfile.unit === 'lbs' ? Math.round(w.tonnage_kg * 2.20462) : Math.round(w.tonnage_kg))
                )
                const maxVal = Math.max(...values, 1)
                const totalW = chartData.length * (barW + gap) - gap
                return (
                  <svg width="100%" viewBox={`0 0 ${totalW} ${H + 34}`} style={{ display: 'block', overflow: 'visible' }}>
                    {chartData.map((wk, i) => {
                      const isCurrent = progressRange === 'week' ? wk.is_today : i === chartData.length - 1
                      const val = values[i]
                      const x = i * (barW + gap)
                      const barH = val > 0 ? Math.max(Math.round((val / maxVal) * H), 6) : 3
                      const y = H - barH
                      const lbl = progressRange === 'week' ? wk.day : (() => { const d = new Date(wk.week_start + 'T00:00:00'); return d.toLocaleDateString('default', { month: 'short', day: 'numeric' }) })()
                      const displayVal = volumeMetric === 'sets' ? String(val) : fmtTonnage(wk.tonnage_kg, activeProfile.unit)
                      return (
                        <g key={i}>
                          <rect x={x} y={y} width={barW} height={barH}
                            fill={isCurrent ? 'var(--accent)' : 'var(--bg-secondary)'}
                            rx={4} />
                      {val > 0 && (
                            <text x={x + barW / 2} y={barH >= 22 ? y + 14 : y - 5} textAnchor="middle"
                              fill={barH >= 22 ? '#fff' : (isCurrent ? 'var(--accent)' : 'var(--text)')}
                              fontSize={10} fontWeight={isCurrent ? 700 : 500} opacity={barH >= 22 ? 0.85 : 1}>{displayVal}</text>
                          )}
                          <text x={x + barW / 2} y={H + 18} textAnchor="middle"
                            fill={isCurrent ? 'var(--accent)' : 'var(--muted)'}
                            fontSize={progressRange === 'week' ? 9 : 8}>{lbl}</text>
                        </g>
                      )
                    })}
                  </svg>
                )
              })()}
            </div>

            {/* Muscle focus donut */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p className="section-heading" style={{ margin: 0 }}>Muscle Focus</p>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['sets','Sets'],['tonnage','Tonnage']].map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => setVolumeMetric(val)}
                      style={{ padding: '3px 10px', borderRadius: 6, border: volumeMetric === val ? '2px solid var(--accent)' : '1px solid var(--border)', background: volumeMetric === val ? 'var(--accent)' : 'transparent', color: volumeMetric === val ? '#fff' : 'var(--text)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {muscleCache[progressRange] === undefined ? <p className="muted">Loading…</p> : (() => {
                const muscleData = muscleCache[progressRange] || []
                const COLORS = ['#e06c75','#61afef','#98c379','#c678dd','#e5c07b','#56b6c2','#ff9580','#bd93f9','#abb2bf']
                const cx = 90, cy = 90, R = 76, r = 46
                const toRad = deg => deg * Math.PI / 180
                const vals = muscleData.map(d => volumeMetric === 'sets' ? d.sets : (activeProfile.unit === 'lbs' ? Math.round(d.tonnage_kg * 2.20462) : Math.round(d.tonnage_kg)))
                const total = vals.reduce((a, b) => a + b, 0)
                const rawTonnage = muscleData.reduce((s, d) => s + d.tonnage_kg, 0)
                const centerLabel = volumeMetric === 'sets' ? total : fmtTonnage(rawTonnage, activeProfile.unit)
                const centerSub = volumeMetric === 'sets' ? 'sets' : activeProfile.unit
                function slicePath(startDeg, endDeg) {
                  const s = startDeg - 90, e = endDeg - 90
                  const x1 = cx + R * Math.cos(toRad(s)), y1 = cy + R * Math.sin(toRad(s))
                  const x2 = cx + R * Math.cos(toRad(e)), y2 = cy + R * Math.sin(toRad(e))
                  const x3 = cx + r * Math.cos(toRad(e)), y3 = cy + r * Math.sin(toRad(e))
                  const x4 = cx + r * Math.cos(toRad(s)), y4 = cy + r * Math.sin(toRad(s))
                  const large = (endDeg - startDeg) > 180 ? 1 : 0
                  return `M${x1},${y1} A${R},${R},0,${large},1,${x2},${y2} L${x3},${y3} A${r},${r},0,${large},0,${x4},${y4} Z`
                }
                let startDeg = 0
                const slices = total > 0 ? muscleData.map((d, i) => {
                  const endDeg = startDeg + (vals[i] / total) * 360
                  const path = slicePath(startDeg, Math.min(endDeg, startDeg + 359.99))
                  const el = <path key={i} d={path} fill={COLORS[i % COLORS.length]} />
                  startDeg = endDeg; return el
                }) : null
                return (
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <svg width={180} height={180} viewBox="0 0 180 180" style={{ flexShrink: 0 }}>
                      {total === 0 && <circle cx={cx} cy={cy} r={R} fill="var(--bg-secondary)" />}
                      {slices}
                      <circle cx={cx} cy={cy} r={r} fill="var(--card)" />
                      <text x={cx} y={cy - 7} textAnchor="middle" fontSize={20} fontWeight={800} fill="var(--text)">{centerLabel}</text>
                      <text x={cx} y={cy + 13} textAnchor="middle" fontSize={11} fill="var(--muted)">{centerSub}</text>
                    </svg>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {muscleData.length === 0
                        ? <p className="muted small">No data in this range.</p>
                        : muscleData.map((d, i) => {
                            const pct = total > 0 ? Math.round(vals[i] / total * 100) : 0
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                <span style={{ fontSize: '0.9rem', flex: 1, fontWeight: 500 }}>{d.body_part}</span>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>{pct}%</span>
                              </div>
                            )
                          })
                      }
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* PRs */}
            <div className="card">
              <p className="section-heading">Personal Records</p>
              <p className="muted small" style={{ marginTop: -4, marginBottom: 12 }}>Best estimated 1RM per exercise (Epley formula)</p>
              {!prsLoaded ? (
                <p className="muted">Loading…</p>
              ) : prs.length === 0 ? (
                <p className="muted">No sets logged yet — finish a workout to see PRs.</p>
              ) : prGroupKeys.map(group => (
                <div key={group} style={{ marginBottom: 20 }}>
                  <div className="group-label">{group}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {prsByPart[group].map(pr => (
                      <div key={pr.exercise_id} className="pr-row">
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{pr.name}</div>
                          <div className="muted small">{pr.best_reps} reps × {fmtWeight(pr.best_weight, activeProfile.unit)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--accent)' }}>{fmtWeight(pr.e1rm, activeProfile.unit)}</div>
                          <div className="muted small">est. 1RM</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>


          </section>
        )}
      </main>

      <nav className={`tabs style-${navStyle}`}>
        <div className="tabs-inner">
        <button className={(pendingTab ?? activeTab) === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
          <span className="tab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10.5z"/>
              <path d="M9 22V12h6v10"/>
            </svg>
          </span>
          <span className="tab-label">Home</span>
        </button>
        <button className={(pendingTab ?? activeTab) === 'exercises' ? 'active' : ''} onClick={() => setTab('exercises')}>
          <span className="tab-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="10.5" width="4" height="3" rx="1"/>
              <rect x="18" y="10.5" width="4" height="3" rx="1"/>
              <rect x="6" y="8.5" width="3" height="7" rx="1"/>
              <rect x="15" y="8.5" width="3" height="7" rx="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
            </svg>
          </span>
          <span className="tab-label">Exercises</span>
        </button>
        <button className={(pendingTab ?? activeTab) === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          <span className="tab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="2"/>
              <path d="M16 2v4M8 2v4M3 9h18"/>
              <line x1="7" y1="13" x2="10" y2="13"/>
              <line x1="7" y1="17" x2="10" y2="17"/>
              <line x1="13" y1="13" x2="17" y2="13"/>
              <line x1="13" y1="17" x2="17" y2="17"/>
            </svg>
          </span>
          <span className="tab-label">History</span>
        </button>
        <button className={(pendingTab ?? activeTab) === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>
          <span className="tab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="12" width="4" height="9" rx="1"/>
              <rect x="10" y="7" width="4" height="14" rx="1"/>
              <rect x="17" y="3" width="4" height="18" rx="1"/>
            </svg>
          </span>
          <span className="tab-label">Progress</span>
          </button>
        </div>
      </nav>
      {deleteExercisePending && (
        <div className="glass-overlay" style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card glass-panel" style={{ width: '100%', maxWidth: 360 }}>
            <p className="section-heading" style={{ marginTop: 0 }}>Delete exercise?</p>
            <p className="muted" style={{ marginBottom: 20 }}>"<strong>{deleteExercisePending.name}</strong>" and all its logged history will be permanently deleted. This cannot be undone.</p>
            <div className="row">
              <button onClick={() => setDeleteExercisePending(null)} style={{ flex: 1 }}>Cancel</button>
              <button onClick={confirmDeleteExercise}
                style={{ flex: 1, background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showTemplateSheet && (
        <BottomSheet onClose={() => setShowTemplateSheet(false)} maxHeight="80vh"
          dragZoneContent={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 18px 6px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Start from template</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>Pick a past workout to pre-load its exercises</div>
              </div>
              <button onClick={() => setShowTemplateSheet(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center' }}><IconX size={18} /></button>
            </div>
          }>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...workouts]
              .filter(w => w.status === 'finished')
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, 15)
              .map(w => {
                return (
                  <button key={w.id} type="button" onClick={() => handleStartFromTemplate(w)}
                    style={{ width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.97rem', marginBottom: 3 }}>{w.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {fmtDate(w.date, { weekday: 'short', month: 'short', day: 'numeric' })} &middot; {w.unique_exercises_count ?? 0} ex &middot; {w.set_count ?? 0} sets
                    </div>
                  </button>
                )
              })
            }
          </div>
        </BottomSheet>
      )}

      {detailSheet && (
        <WorkoutDetailSheet
          workout={detailSheet.workout}
          detail={detailSheet.detail}
          exercises={exercises}
          unit={activeProfile.unit}
          onClose={() => setDetailSheet(null)}
          onDelete={async (id) => {
            await deleteWorkout(id)
            setWorkouts(ws => ws.filter(w => w.id !== id))
            setDetailSheet(null)
          }}
        />
      )}

      {/* Settings bottom sheet */}
      {showSettings && (
        <BottomSheet onClose={() => { setShowSettings(false); setPinSettingMode(null) }} maxHeight="88vh"
          dragZoneContent={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: activeProfile.avatar_color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
                  {activeProfile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{activeProfile.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Profile settings</div>
                </div>
              </div>
              <button onClick={() => { setShowSettings(false); setPinSettingMode(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center' }}><IconX size={18} /></button>
            </div>
          }>
            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ── PROFILE ── */}
              <div className="settings-section">
                <div className="settings-section-label">Profile</div>
                <div className="settings-rows">
                  <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                    <div className="settings-row-label" style={{ marginBottom: 8 }}>Name</div>
                    <ProfileNameEditor profile={activeProfile} onSave={async name => {
                      const updated = await updateProfile(activeProfile.id, { name })
                      setActiveProfile(prev => ({ ...prev, name: updated.name }))
                    }} />
                  </div>
                  <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                    <div className="settings-row-label" style={{ marginBottom: 10 }}>Avatar Colour</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {AVATAR_COLORS.map(c => (
                        <button key={c} type="button" onClick={async () => {
                          if (activeProfile.avatar_color === c) return
                          const updated = await updateProfile(activeProfile.id, { avatar_color: c })
                          setActiveProfile(prev => ({ ...prev, avatar_color: updated.avatar_color }))
                        }} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: activeProfile.avatar_color === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer', padding: 0, outline: 'none' }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── APPEARANCE ── */}
              <div className="settings-section">
                <div className="settings-section-label">Appearance</div>
                <div className="settings-rows">
                  {/* Theme */}
                  <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                    <div className="settings-row-label" style={{ marginBottom: 10 }}>Theme</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {THEMES.map(t => (
                        <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                          <button type="button"
                            className={`theme-swatch${activeProfile.theme === t.id ? ' active' : ''}`}
                            style={{ background: t.color }} title={t.label}
                            onClick={async () => {
                              if (activeProfile.theme === t.id) return
                              const updated = await updateProfile(activeProfile.id, { theme: t.id })
                              setActiveProfile(prev => ({ ...prev, theme: updated.theme }))
                            }} />
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{t.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Nav bar */}
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-label">Nav Bar</div>
                      <div className="settings-row-sub">Frosted = labels + blur · Bubble = icons only</div>
                    </div>
                    <button type="button" onClick={() => {
                      const next = navStyle === 'frosted' ? 'bubble' : 'frosted'
                      localStorage.setItem('navStyle', next)
                      setNavStyle(next)
                    }} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0 }}>
                      {navStyle === 'frosted' ? 'Frosted' : 'Bubble'}
                    </button>
                  </div>
                  {/* Animations */}
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-label">Animations</div>
                      <div className="settings-row-sub">Transitions, entrance effects, pulses</div>
                    </div>
                    <button type="button" onClick={() => {
                      const next = !animationsEnabled
                      localStorage.setItem('animations', next ? 'true' : 'false')
                      setAnimationsEnabled(next)
                    }} style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', padding: 2, background: animationsEnabled ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: animationsEnabled ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
                    </button>
                  </div>
                  {/* Liquid Glass */}
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-label">Liquid Glass</div>
                      <div className="settings-row-sub">Frosted, refractive sheets &amp; modals</div>
                    </div>
                    <button type="button" onClick={() => {
                      const next = !liquidGlass
                      localStorage.setItem('liquidGlass', next ? 'true' : 'false')
                      setLiquidGlass(next)
                    }} style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', padding: 2, background: liquidGlass ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: liquidGlass ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── WORKOUT ── */}
              <div className="settings-section">
                <div className="settings-section-label">Workout</div>
                <div className="settings-rows">
                  {/* Units */}
                  <div className="settings-row">
                    <div className="settings-row-label">Units</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['kg', 'lbs'].map(u => (
                        <button key={u} type="button"
                          className={activeProfile.unit === u ? 'primary' : ''}
                          style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border)', fontFamily: 'inherit', cursor: 'pointer' }}
                          onClick={async () => {
                            if (activeProfile.unit === u) return
                            const updated = await updateProfile(activeProfile.id, { unit: u })
                            setActiveProfile(prev => ({ ...prev, unit: updated.unit }))
                            setPrsLoaded(false)
                          }}>{u}</button>
                      ))}
                    </div>
                  </div>
                  {/* Week starts */}
                  <div className="settings-row">
                    <div className="settings-row-label">Week Starts On</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[['monday','Mon'],['sunday','Sun']].map(([val, label]) => (
                        <button key={val} type="button"
                          className={activeProfile.week_start === val ? 'primary' : ''}
                          style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border)', fontFamily: 'inherit', cursor: 'pointer' }}
                          onClick={async () => {
                            if (activeProfile.week_start === val) return
                            const updated = await updateProfile(activeProfile.id, { week_start: val })
                            setActiveProfile(prev => ({ ...prev, week_start: updated.week_start }))
                          }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {/* Rest duration */}
                  <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                    <div className="settings-row-label" style={{ marginBottom: 8 }}>Default Rest Duration</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[60, 90, 120, 180].map(d => (
                        <button key={d} type="button"
                          className={(activeProfile.rest_duration || 90) === d ? 'primary' : ''}
                          style={{ flex: 1, padding: '6px 0', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border)', fontFamily: 'inherit', cursor: 'pointer' }}
                          onClick={async () => {
                            if ((activeProfile.rest_duration || 90) === d) return
                            const updated = await updateProfile(activeProfile.id, { rest_duration: d })
                            setActiveProfile(prev => ({ ...prev, rest_duration: updated.rest_duration }))
                          }}>{d}s</button>
                      ))}
                    </div>
                  </div>
                  {/* Ding */}
                  <div className="settings-row">
                    <div className="settings-row-label">Timer Ding Sound</div>
                    <button type="button" onClick={async () => {
                      const next = !(activeProfile.ding_enabled !== false)
                      const updated = await updateProfile(activeProfile.id, { ding_enabled: next })
                      setActiveProfile(prev => ({ ...prev, ding_enabled: updated.ding_enabled }))
                    }} style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', padding: 2, background: activeProfile.ding_enabled !== false ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: activeProfile.ding_enabled !== false ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
                    </button>
                  </div>
                  {/* Overload hints */}
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-label">Overload Hints</div>
                      <div className="settings-row-sub">Suggest next weight during workouts</div>
                    </div>
                    <button type="button" onClick={async () => {
                      const next = !(activeProfile.overload_hints !== false)
                      const updated = await updateProfile(activeProfile.id, { overload_hints: next })
                      setActiveProfile(prev => ({ ...prev, overload_hints: updated.overload_hints }))
                    }} style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', padding: 2, background: activeProfile.overload_hints !== false ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: activeProfile.overload_hints !== false ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
                    </button>
                  </div>
                  {/* Plate calc */}
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-label">Plate Calculator</div>
                      <div className="settings-row-sub">Plates breakdown for barbell lifts</div>
                    </div>
                    <button type="button" onClick={async () => {
                      const next = !(activeProfile.plate_calculator !== false)
                      const updated = await updateProfile(activeProfile.id, { plate_calculator: next })
                      setActiveProfile(prev => ({ ...prev, plate_calculator: updated.plate_calculator }))
                    }} style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', padding: 2, background: activeProfile.plate_calculator !== false ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: activeProfile.plate_calculator !== false ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── DATA ── */}
              <div className="settings-section">
                <div className="settings-section-label">Data</div>
                <div className="settings-rows">
                  <div className="settings-row">
                    <div className="settings-row-label">Export CSV</div>
                    <button type="button" style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border)', fontFamily: 'inherit', cursor: 'pointer' }} onClick={async () => {
                      const url = `/api/profiles/${activeProfile.id}/export.csv`
                      const token = localStorage.getItem('liftyToken')
                      const headers = token ? { Authorization: `Bearer ${token}` } : {}
                      try {
                        const res = await fetch(url, { headers })
                        const blob = await res.blob()
                        const file = new File([blob], 'lifty_export.csv', { type: 'text/csv' })
                        if (navigator.canShare?.({ files: [file] })) {
                          await navigator.share({ files: [file], title: 'lifty export' })
                          return
                        }
                      } catch {}
                      // fallback: direct download
                      const a = document.createElement('a')
                      a.href = url; a.download = 'lifty_export.csv'; a.click()
                    }}><IconDownload size={14} /> Export</button>
                  </div>
                  <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="settings-row-label">Import from Strong</div>
                        <div className="settings-row-sub">Already imported workouts are skipped</div>
                      </div>
                      <label style={{ margin: 0 }}>
                        <input type="file" accept=".csv" style={{ display: 'none' }}
                          onChange={async e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            e.target.value = ''
                            setImportState('loading')
                            try {
                              const result = await importStrong(file, activeProfile.id)
                              setImportState(result)
                              const [ws, exs] = await Promise.all([listWorkouts(activeProfile.id), listExercises(activeProfile.id)])
                              setWorkouts(ws); setExercises(exs)
                            } catch { setImportState({ error: 'Import failed. Check the file format.' }) }
                          }}
                        />
                        <button type="button"
                          style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border)', fontFamily: 'inherit', cursor: 'pointer', pointerEvents: 'none' }}
                          onClick={e => e.currentTarget.parentElement.querySelector('input').click()}
                          disabled={importState === 'loading'}>
                          {importState === 'loading' ? 'Importing…' : <><IconUpload size={14} /> Import</>}
                        </button>
                      </label>
                    </div>
                    {importState && importState !== 'loading' && (
                      <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px', marginTop: 10, fontSize: '0.82rem' }}>
                        {importState.error
                          ? <span style={{ color: 'var(--danger)' }}><IconXCircle size={13} /> {importState.error}</span>
                          : <span style={{ color: 'var(--accent)' }}><IconCheck size={13} /> Imported {importState.imported_workouts} workout{importState.imported_workouts !== 1 ? 's' : ''} · {importState.imported_sets} sets · {importState.created_exercises} new exercise{importState.created_exercises !== 1 ? 's' : ''}{importState.skipped_workouts > 0 ? ` (${importState.skipped_workouts} skipped)` : ''}</span>
                        }
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── SECURITY ── */}
              <div className="settings-section">
                <div className="settings-section-label">Security</div>
                <div className="settings-rows">
                  {/* Profile password */}
                  <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="settings-row-label">Profile Password</div>
                        <div className="settings-row-sub">{activeProfile.has_pin ? 'Password set — required on profile switch' : 'No password — anyone can select this profile'}</div>
                      </div>
                      {!pinSettingMode && (
                        <button type="button"
                          style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0 }}
                          onClick={() => setPinSettingMode(activeProfile.has_pin ? 'change' : 'set')}>
                          {activeProfile.has_pin ? 'Change' : 'Set'}
                        </button>
                      )}
                    </div>
                    {activeProfile.has_pin && !pinSettingMode && (
                      <button type="button" style={{ marginTop: 10, color: 'var(--danger)', width: '100%' }} onClick={async () => {
                        const updated = await setPin(activeProfile.id, null)
                        setActiveProfile(p => ({ ...p, has_pin: updated.has_pin }))
                      }}>Remove Password</button>
                    )}
                    {pinSettingMode && (
                      <div style={{ marginTop: 10 }}>
                        <PinSetForm
                          onSave={async pw => {
                            const updated = await setPin(activeProfile.id, pw)
                            setActiveProfile(p => ({ ...p, has_pin: updated.has_pin }))
                            setPinSettingMode(null)
                          }}
                          onCancel={() => setPinSettingMode(null)}
                        />
                      </div>
                    )}
                  </div>
                  {/* Instance Auth */}
                  {authEnabled && (
                    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div className="settings-row-label">Instance Auth</div>
                          <div className="settings-row-sub">App-wide password protection</div>
                        </div>
                        {!pwChangeMode && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }} onClick={() => setPwChangeMode(true)}>Change</button>
                            <button type="button" style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }} onClick={() => {
                              localStorage.removeItem('liftyToken')
                              setIsAuthed(false)
                              setShowSettings(false)
                            }}>Sign Out</button>
                          </div>
                        )}
                      </div>
                      {pwChangeMode && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input type="password" placeholder="Current password" value={pwChangeCurrent} onChange={e => setPwChangeCurrent(e.target.value)} style={{ margin: 0 }} />
                          <input type="password" placeholder="New password (min 4 chars)" value={pwChangeNew} onChange={e => setPwChangeNew(e.target.value)} style={{ margin: 0 }} />
                          {pwChangeError && <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{pwChangeError}</div>}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="primary" style={{ flex: 1 }} onClick={async () => {
                              const res = await authChangePassword(pwChangeCurrent, pwChangeNew)
                              if (res.token) { localStorage.setItem('liftyToken', res.token); setPwChangeMode(false); setPwChangeCurrent(''); setPwChangeNew(''); setPwChangeError('') }
                              else setPwChangeError(res.detail || 'Failed')
                            }}>Save</button>
                            <button type="button" style={{ flex: 1 }} onClick={() => { setPwChangeMode(false); setPwChangeCurrent(''); setPwChangeNew(''); setPwChangeError('') }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── ACCOUNT ── */}
              <div className="settings-section">
                <div className="settings-section-label">Account</div>
                <div className="settings-rows">
                  <div className="settings-row">
                    <button type="button" style={{ width: '100%' }} onClick={() => {
                      localStorage.removeItem('activeProfileId')
                      setActiveProfile(null)
                      setShowSettings(false)
                      setPinSettingMode(null)
                    }}>Switch Profile</button>
                  </div>
                </div>
              </div>

              {/* Danger zone */}
              <DangerZone profileId={activeProfile.id} onDeleted={async () => {
                const ws = await listWorkouts(activeProfile.id)
                setWorkouts(ws)
                setPrsLoaded(false)
              }} />

              {/* About pill */}
              <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                <button type="button" onClick={() => setShowAbout(true)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 16px', fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
                  v1.0.0
                </button>
              </div>

            </div>
        </BottomSheet>
      )}

      {/* About modal */}
      {showAbout && (
        <div className="glass-overlay" onClick={() => setShowAbout(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
          <div className="glass-panel" onClick={e => e.stopPropagation()}
            style={{ borderRadius: 20, padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
              border: '2px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <Dumbbell size={28} strokeWidth={1.6} color="var(--accent)" />
            </div>
            <h2 style={{ margin: '0 0 4px', fontWeight: 900, fontSize: '1.3rem' }}>lifty</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Self-hosted workout tracker</p>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 16px', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Release</span>
              <a href="https://github.com/bndct-devops/lifty/releases/tag/v1.0.0"
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                v1.0.0 ↗
              </a>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Commit</span>
              {import.meta.env.VITE_COMMIT_SHA ? (
                <a href={`https://github.com/bndct-devops/lifty/commit/${import.meta.env.VITE_COMMIT_SHA}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--text-muted)', textDecoration: 'none', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {String(import.meta.env.VITE_COMMIT_SHA).slice(0, 7)} ↗
                </a>
              ) : (
                <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>dev</span>
              )}
            </div>
            <button type="button" className="primary" style={{ width: '100%' }} onClick={() => setShowAbout(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Reusable bottom sheet with swipe-to-dismiss and body scroll lock
function DangerZone({ profileId, onDeleted }) {
  const [confirmText, setConfirmText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const ready = confirmText === 'confirm'

  async function handleDelete() {
    if (!ready || busy) return
    setBusy(true)
    try {
      await deleteAllWorkouts(profileId)
      setConfirmText('')
      setDone(true)
      await onDeleted()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ margin: 0, border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="section-heading" style={{ color: 'var(--danger)', margin: 0 }}>Danger Zone</p>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Permanently delete all workouts for this profile. Useful before re-importing. This cannot be undone.
      </p>
      {done
        ? <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--accent)' }}>✅ All workouts deleted.</p>
        : <>
            <input
              value={confirmText}
              onChange={e => { setConfirmText(e.target.value); setDone(false) }}
              placeholder='Type "confirm" to enable'
              style={{ margin: 0 }}
            />
            <button
              type="button"
              disabled={!ready || busy}
              onClick={handleDelete}
              style={{ width: '100%', background: ready ? 'var(--danger)' : 'var(--bg-secondary)', color: ready ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed', opacity: busy ? 0.6 : 1, fontFamily: 'inherit', fontSize: '1rem', transition: 'background 0.15s' }}>
              {busy ? 'Deleting…' : <><Trash2 size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Delete All Workouts</>}
            </button>
          </>
      }
    </div>
  )
}

function AddExerciseForm({ BODY_PARTS, EQUIPMENT, onAdd }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [desc, setDesc] = React.useState('')
  const [bodyPart, setBodyPart] = React.useState('')
  const [equipment, setEquipment] = React.useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    await onAdd({ name: name.trim(), description: desc.trim() || null, body_part: bodyPart || null, equipment: equipment || null })
    setName(''); setDesc(''); setBodyPart(''); setEquipment(''); setOpen(false)
  }

  if (!open) return (
    <button
      type="button"
      className="primary"
      style={{ width: '100%', marginTop: 12 }}
      onClick={() => setOpen(true)}
    >＋ Add Exercise</button>
  )

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginTop: 12 }}>
      <p className="section-heading" style={{ marginTop: 0 }}>New Exercise</p>
      <input
        placeholder="Name *"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
      />
      <input
        placeholder="Description (optional)"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={bodyPart} onChange={e => setBodyPart(e.target.value)} style={{ flex: 1 }}>
          <option value="">Body part…</option>
          {BODY_PARTS.filter(p => p !== 'All').map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={equipment} onChange={e => setEquipment(e.target.value)} style={{ flex: 1 }}>
          <option value="">Equipment…</option>
          {EQUIPMENT.map(eq => <option key={eq} value={eq}>{eq}</option>)}
        </select>
      </div>
      <div className="row">
        <button type="button" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="primary">Add</button>
      </div>
    </form>
  )
}

function WorkoutDetailSheet({ workout, detail, exercises, unit, onClose, onDelete }) {
  const COLORS = ['#e06c75','#61afef','#98c379','#c678dd','#e5c07b','#56b6c2','#ff9580','#bd93f9','#abb2bf']
  const BODY_PART_ORDER = ['Chest','Back','Legs','Shoulders','Arms','Core','Full Body','Cardio','Other']
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  function e1rm(weight, reps) {
    if (!weight || !reps || reps <= 0) return null
    return Math.round(weight * (1 + reps / 30))
  }
  const sets = detail?.sets || []
  const dispW = kg => kg == null ? '\u2014' : unit === 'lbs' ? Math.round(kg * 2.20462 * 10) / 10 : kg
  const byEx = sets.reduce((acc, s) => {
    acc[s.exercise_id] = acc[s.exercise_id] || []; acc[s.exercise_id].push(s); return acc
  }, {})

  // Stats
  const totalSets = sets.length
  const totalTonnage = sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0)
  const displayTonnage = unit === 'lbs' ? Math.round(totalTonnage * 2.20462) : Math.round(totalTonnage)
  const dur = (() => {
    if (!workout.start_time || !workout.end_time) return null
    const s = workout.start_time.endsWith('Z') ? workout.start_time : workout.start_time + 'Z'
    const e = workout.end_time.endsWith('Z') ? workout.end_time : workout.end_time + 'Z'
    const mins = Math.floor((new Date(e) - new Date(s)) / 60000)
    return mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`
  })()
  const dateStr = new Date((workout.date || '').slice(0, 10) + 'T12:00').toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Mini muscle donut
  const muscleMap = {}
  sets.forEach(s => {
    const ex = exercises.find(e => e.id == s.exercise_id)
    const part = ex?.body_part || 'Other'
    muscleMap[part] = (muscleMap[part] || 0) + 1
  })
  const muscleEntries = Object.entries(muscleMap).sort((a, b) => b[1] - a[1])
  const totalMuscleSets = muscleEntries.reduce((s, [, v]) => s + v, 0)
  function slicePath(cx, cy, R, r, startDeg, endDeg) {
    const toRad = d => d * Math.PI / 180
    const s = startDeg - 90, e = endDeg - 90
    const large = (endDeg - startDeg) > 180 ? 1 : 0
    const x1 = cx + R * Math.cos(toRad(s)), y1 = cy + R * Math.sin(toRad(s))
    const x2 = cx + R * Math.cos(toRad(e)), y2 = cy + R * Math.sin(toRad(e))
    const x3 = cx + r * Math.cos(toRad(e)), y3 = cy + r * Math.sin(toRad(e))
    const x4 = cx + r * Math.cos(toRad(s)), y4 = cy + r * Math.sin(toRad(s))
    return `M${x1},${y1} A${R},${R},0,${large},1,${x2},${y2} L${x3},${y3} A${r},${r},0,${large},0,${x4},${y4} Z`
  }
  let degCursor = 0
  const donutSlices = totalMuscleSets > 0 ? muscleEntries.map(([part, count], i) => {
    const end = degCursor + (count / totalMuscleSets) * 360
    const path = slicePath(36, 36, 30, 18, degCursor, Math.min(end, degCursor + 359.99))
    degCursor = end
    return <path key={part} d={path} fill={COLORS[i % COLORS.length]} />
  }) : null

  return (
    <BottomSheet onClose={onClose} maxHeight="90vh" zIndex={300}
      dragZoneContent={<>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 18px 14px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.name}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>{dateStr}</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 8, width: 32, height: 32, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 }}><IconX size={16} /></button>
        </div>

        {/* Stats + donut row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px 16px', borderBottom: '1px solid var(--border)' }}>
          {/* Mini donut */}
          {totalMuscleSets > 0 && (
            <svg width={72} height={72} viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
              {donutSlices}
              <circle cx={36} cy={36} r={18} fill="var(--card)" />
            </svg>
          )}
          {/* Stat pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1 }}>
            {[
              [totalSets, 'sets'],
              [Object.keys(byEx).length, 'exercises'],
              displayTonnage > 0 ? [`${displayTonnage.toLocaleString()} ${unit}`, 'volume'] : null,
              dur ? [dur, 'duration'] : null,
            ].filter(Boolean).map(([val, lbl]) => (
              <div key={lbl} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>{val}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Muscle legend (compact) */}
        {muscleEntries.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 18px 4px' }}>
            {muscleEntries.map(([part, count], i) => (
              <div key={part} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-secondary)', borderRadius: 20, padding: '3px 10px 3px 6px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{part}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{Math.round(count / totalMuscleSets * 100)}%</span>
              </div>
            ))}
          </div>
        )}
      </>}>

        {/* Notes */}
        {workout.notes && (
          <div style={{ padding: '10px 18px 6px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notes</div>
            <MiniMarkdown text={workout.notes} />
          </div>
        )}

        {/* Sets body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 32px' }}>
          {Object.entries(byEx).map(([exId, exSets]) => {
            const ex = exercises.find(e => e.id == exId)
            const partIdx = BODY_PART_ORDER.indexOf(ex?.body_part)
            const color = COLORS[muscleEntries.findIndex(([p]) => p === (ex?.body_part || 'Other')) % COLORS.length]
            return (
              <div key={exId} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 6, borderBottom: `2px solid ${color || 'var(--accent)'}`, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: color || 'var(--accent)' }}>{ex?.name || `Exercise ${exId}`}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.04em' }}>1RM</span>
                </div>
                {exSets.map((s, i) => {
                  const rm = e1rm(s.weight, s.reps)
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ width: 22, fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: '0.92rem' }}>{dispW(s.weight)} {unit} × {s.reps ?? '\u2014'}</span>
                      <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--muted)', minWidth: 32, textAlign: 'right' }}>{rm ?? '\u2014'}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Delete workout */}
        <div style={{ padding: '8px 18px 32px', borderTop: '1px solid var(--border)' }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Delete this workout?</span>
              <button onClick={() => setConfirmDelete(false)}
                style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => onDelete && onDelete(workout.id)}
                style={{ background: '#e53e3e', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: '#fff', fontFamily: 'inherit' }}>Delete</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
              <Trash2 size={14} />
              Delete workout
            </button>
          )}
        </div>
    </BottomSheet>
  )
}

function ProfileSelector({ profiles, onSelect, onCreate }) {
  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [pinTarget, setPinTarget] = React.useState(null)
  const [pwInput, setPwInput] = React.useState('')
  const [showPw, setShowPw] = React.useState(false)
  const [pinError, setPinError] = React.useState('')
  const [pinVerifying, setPinVerifying] = React.useState(false)
  const [lockedUntil, setLockedUntil] = React.useState(0)
  const [, forceUpdate] = React.useReducer(x => x + 1, 0)

  // countdown tick while locked out
  React.useEffect(() => {
    if (lockedUntil <= 0) return
    const id = setInterval(() => {
      if (Date.now() >= lockedUntil) { setLockedUntil(0); clearInterval(id) }
      else forceUpdate()
    }, 1000)
    return () => clearInterval(id)
  }, [lockedUntil])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    await onCreate(newName.trim())
    setSaving(false)
  }

  function handleProfileClick(p) {
    if (p.has_pin) {
      setPinTarget(p); setPwInput(''); setPinError(''); setShowPw(false); setLockedUntil(0)
    } else {
      onSelect(p)
    }
  }

  async function submitPw(e) {
    e.preventDefault()
    if (!pwInput.trim() || pinVerifying) return
    setPinVerifying(true)
    setPinError('')
    const result = await verifyPin(pinTarget.id, pwInput)
    setPinVerifying(false)
    if (result.ok) {
      onSelect(pinTarget)
    } else if (result.locked) {
      setLockedUntil(Date.now() + result.retry_after * 1000)
      setPwInput('')
    } else {
      setPinError('Incorrect password')
      setPwInput('')
      setTimeout(() => setPinError(''), 600)
    }
  }

  const secsLeft = lockedUntil > 0 ? Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)) : 0

  if (pinTarget) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px 16px', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: pinTarget.avatar_color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.6rem', margin: '0 auto 12px' }}>
            {pinTarget.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{pinTarget.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>Enter password to continue</div>
        </div>

        <form onSubmit={submitPw} style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showPw ? 'text' : 'password'}
              autoFocus
              autoComplete="current-password"
              placeholder="Password"
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPinError('') }}
              disabled={pinVerifying || secsLeft > 0}
              style={{ width: '100%', paddingRight: 44, marginBottom: 0, animation: pinError ? 'pinShake 0.4s ease' : 'none', borderColor: pinError ? 'var(--danger)' : undefined }}
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
              style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem', padding: 4, lineHeight: 1 }}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {pinError && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>{pinError}</div>}
          {secsLeft > 0 && (
            <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>
              Too many attempts — try again in {secsLeft}s
            </div>
          )}
          <button type="submit" className="primary" style={{ width: '100%' }}
            disabled={pinVerifying || !pwInput.trim() || secsLeft > 0}>
            {pinVerifying ? 'Checking…' : 'Unlock →'}
          </button>
        </form>

        <button type="button" onClick={() => { setPinTarget(null); setPwInput('') }}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer', padding: 8 }}>
          ← Back
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px 16px', gap: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 8, animation: 'celebrationPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%',
          background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
          border: '2px solid color-mix(in srgb, var(--accent) 35%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          animation: 'flamePulse 3s ease-in-out infinite',
          boxShadow: '0 0 32px color-mix(in srgb, var(--accent) 18%, transparent)',
        }}>
          <Dumbbell size={40} strokeWidth={1.6} color='var(--accent)' />
        </div>
        <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.5px' }}>lifty</h1>
        <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '1rem' }}>Who's training today?</p>
      </div>

      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {profiles.map((p, i) => (
          <button key={p.id} type="button" onClick={() => handleProfileClick(p)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', textAlign: 'left', fontSize: '1rem', fontWeight: 600, color: 'var(--text)', animation: 'slideUp 0.35s ease both', animationDelay: `${i * 60}ms` }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: p.avatar_color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0, boxShadow: `0 2px 8px color-mix(in srgb, ${p.avatar_color || 'var(--accent)'} 40%, transparent)` }}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <span style={{ flex: 1 }}>{p.name}</span>
            {p.has_pin && <Lock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        ))}

        {!creating ? (
          <button type="button" onClick={() => setCreating(true)}
            style={{ padding: '14px 18px', borderRadius: 12, border: '2px dashed var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.95rem', fontWeight: 600 }}>
            ＋ New Profile
          </button>
        ) : (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <input
              autoFocus
              placeholder="Your name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{ marginBottom: 0 }}
            />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setCreating(false); setNewName('') }}>Cancel</button>
              <button type="submit" className="primary" disabled={saving || !newName.trim()}>
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function ProfileNameEditor({ profile, onSave }) {
  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState(profile.name)
  const [saving, setSaving] = React.useState(false)

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, fontWeight: 600, fontSize: '1rem' }}>{profile.name}</span>
        <button type="button" onClick={() => setEditing(true)} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>Rename</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 0, flex: 1 }} autoFocus />
      <button type="button" onClick={() => setEditing(false)}>Cancel</button>
      <button type="button" className="primary" disabled={saving || !name.trim()} onClick={async () => {
        setSaving(true)
        await onSave(name.trim())
        setSaving(false)
        setEditing(false)
      }}>{saving ? '…' : 'Save'}</button>
    </div>
  )
}

function PinSetForm({ onSave, onCancel }) {
  const [pw, setPw] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [showPw, setShowPw] = React.useState(false)
  const [error, setError] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (pw.trim().length < 4) { setError('Password must be at least 4 characters'); return }
    if (pw !== confirm) { setError('Passwords do not match'); return }
    setSaving(true)
    await onSave(pw)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input type={showPw ? 'text' : 'password'} autoComplete="new-password"
          placeholder="New password (min 4 chars)" value={pw} maxLength={64}
          onChange={e => { setPw(e.target.value); setError('') }}
          style={{ marginBottom: 0, paddingRight: 44, width: '100%' }} />
        <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
          style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem', padding: 4, lineHeight: 1 }}>
          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <input type={showPw ? 'text' : 'password'} autoComplete="new-password"
        placeholder="Confirm password" value={confirm} maxLength={64}
        onChange={e => { setConfirm(e.target.value); setError('') }}
        style={{ marginBottom: 0 }} />
      {error && <div style={{ color: 'var(--danger)', fontSize: '0.82rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        <button type="submit" className="primary" style={{ flex: 1 }} disabled={saving}>
          {saving ? 'Saving…' : 'Save Password'}
        </button>
      </div>
    </form>
  )
}

