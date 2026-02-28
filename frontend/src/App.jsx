import React, { useEffect, useState } from 'react'
import { listExercises, createExercise, updateExercise, listWorkouts, createWorkout, updateWorkout, startWorkout, finishWorkout, deleteWorkout, deleteAllWorkouts, addSet, updateSet, deleteSet, getWorkoutDetail, getExerciseLastSets, getPRs, getDailyVolume, getWeeklyVolume, getMuscleGroups, listProfiles, createProfile, updateProfile, importStrong, markRestDay, setPin, verifyPin, logBodyweight, getBodyweight, deleteBodyweightEntry, getExerciseHistory } from './api'
import { Dumbbell, Lock, ChevronLeft, ChevronRight, Eye, EyeOff, Trash2, Timer, Flag, CheckCircle2, TrendingUp } from 'lucide-react'

// ── Unit helpers (store in kg internally, display in user's unit) ──
export function fmtWeight(kg, unit) {
  if (kg == null) return '—'
  if (unit === 'lbs') return (Math.round(kg * 2.20462 * 10) / 10) + ' lbs'
  return kg + ' kg'
}
export function parseWeight(val, unit) {
  const n = parseFloat(val)
  if (isNaN(n)) return null
  if (unit === 'lbs') return Math.round(n / 2.20462 * 100) / 100
  return n
}

// Flat inline SVG icons
function IconDownload({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
function IconUpload({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
}
function IconCheck({ size = 14, style = {} }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5, ...style }}><polyline points="20 6 9 17 4 12"/></svg>
}
function IconX({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function IconXCircle({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
}

// Two-tone bell synthesized via Web Audio (no audio file needed)
function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    function tone(freq, t, dur) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = freq
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.35, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.start(t); osc.stop(t + dur)
    }
    tone(1046.5, ctx.currentTime, 1.2)       // C6
    tone(1318.5, ctx.currentTime + 0.18, 1.0) // E6
  } catch (_) {}
}

const THEMES = [
  { id: 'dark',                   label: 'Dark',       color: '#60a5fa' },
  { id: 'light',                  label: 'Light',      color: '#3b82f6' },
  { id: 'catppuccin-mocha',       label: 'Mocha',      color: '#cba6f7' },
  { id: 'catppuccin-macchiato',   label: 'Macchiato',  color: '#c6a0f6' },
  { id: 'catppuccin-frappe',      label: 'Frappé',     color: '#ca9ee6' },
  { id: 'catppuccin-latte',       label: 'Latte',      color: '#8839ef' },
]

const AVATAR_COLORS = ['#F9A8C9','#60a5fa','#cba6f7','#98c379','#e5c07b','#e06c75','#56b6c2','#abb2bf']

export default function App() {
  const [exercises, setExercises] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'home')
  const setTab = t => { setActiveTab(t); localStorage.setItem('activeTab', t) }
  const [sessionWorkout, setSessionWorkout] = useState(null)
  const [timerStart, setTimerStart] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [activeProfile, setActiveProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [profileLoading, setProfileLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [pinSettingMode, setPinSettingMode] = useState(null) // 'set' | 'change' | null
  const [importState, setImportState] = useState(null) // null | 'loading' | {result}
  const [markingRestDay, setMarkingRestDay] = useState(false)
  const [sessionSets, setSessionSets] = useState([])
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(null)
  const [prs, setPrs] = useState([])
  const [prsLoaded, setPrsLoaded] = useState(false)
  const [volumeData, setVolumeData] = useState([])      // [{week_start, sets, tonnage_kg}]
  const [volumeLoaded, setVolumeLoaded] = useState(false)
  const [volumeMetric, setVolumeMetric] = useState('sets') // 'sets' | 'tonnage'
  const [progressRange, setProgressRange] = useState('week')  // 'week' | 4 | 8 | 12 | 26
  const [dailyVolumeData, setDailyVolumeData] = useState([])   // [{date,day,is_today,sets,tonnage_kg}]
  const [dailyVolumeLoaded, setDailyVolumeLoaded] = useState(false)
  const [muscleData, setMuscleData] = useState([])             // [{body_part, sets, tonnage_kg}]
  const [muscleLoaded, setMuscleLoaded] = useState(false)
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
    document.documentElement.setAttribute('data-theme', activeProfile?.theme || 'dark')
  }, [activeProfile?.theme])

  // Load active profile from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem('activeProfileId')
    listProfiles().then(ps => {
      setProfiles(ps || [])
      if (savedId) {
        const found = (ps || []).find(p => p.id === Number(savedId))
        if (found) setActiveProfile(found)
      }
      setProfileLoading(false)
    })
  }, [])

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
      if (progressRange === 'week' && !dailyVolumeLoaded) {
        getDailyVolume(activeProfile.id).then(data => { setDailyVolumeData(data || []); setDailyVolumeLoaded(true) })
      } else if (progressRange !== 'week' && !volumeLoaded) {
        getWeeklyVolume(activeProfile.id, progressRange).then(data => { setVolumeData(data || []); setVolumeLoaded(true) })
      }
    }
    if (activeTab === 'progress' && !muscleLoaded && activeProfile) {
      getMuscleGroups(activeProfile.id, progressRange === 'week' ? 1 : progressRange).then(data => { setMuscleData(data || []); setMuscleLoaded(true) })
    }
    if (activeTab === 'progress' && !bwLoaded && activeProfile) {
      getBodyweight(activeProfile.id).then(data => { setBwData(data || []); setBwLoaded(true) })
    }
  }, [activeTab, prsLoaded, volumeLoaded, dailyVolumeLoaded, muscleLoaded, bwLoaded, progressRange, activeProfile])

  const [exSearch, setExSearch] = useState('')
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
    setVolumeLoaded(false)
    setDailyVolumeLoaded(false)
    setMuscleLoaded(false)
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

  async function handleStartNewWorkout(name) {
    const w = await createWorkout({ name, profile_id: activeProfile?.id })
    const started = await startWorkout(w.id)
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
    setSessionWorkout(started)
    setTimerStart(utcMs(started.start_time))
    setSessionSets(sets)
  }
  async function handleStartWorkout(id) {
    const w = await startWorkout(id)
    setSessionWorkout(w); setTimerStart(utcMs(w.start_time))
    const detail = await getWorkoutDetail(w.id); setSessionSets(detail.sets)
  }

  async function handleFinishWorkout(id) {
    try { await finishWorkout(id) } catch (e) { console.error('finish error', e) }
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
          const p = await createProfile({ name, unit: 'kg', theme: 'dark' })
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
        onExit={() => { setSessionWorkout(null); setTimerStart(null); setSessionSets([]) }}
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
        onRestDurationChange={async d => {
          const updated = await updateProfile(activeProfile.id, { rest_duration: d })
          setActiveProfile(prev => ({ ...prev, rest_duration: updated.rest_duration }))
        }}
      />
    )
  }

  return (
    <div className="app">
      <header className="top">
        <h1>lifty</h1>
        <button type="button" onClick={() => setShowSettings(true)}
          style={{ width: 36, height: 36, borderRadius: '50%', background: activeProfile.avatar_color || 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1rem', flexShrink: 0, fontFamily: 'inherit' }}>
          {activeProfile.name.charAt(0).toUpperCase()}
        </button>
      </header>

      <main className="content">
        {/* ─── HOME ─── */}
        {activeTab === 'home' && (
          <section>
            {inProgress && (
              <div className="card" style={{ border: '2px solid var(--accent)' }}>
                <p className="section-heading" style={{ color: 'var(--accent)' }}>Workout in Progress</p>
                <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{inProgress.name}</div>
                <div className="muted small" style={{ margin: '4px 0 12px' }}>{getWorkoutSummary(inProgress)}</div>
                <button className="primary" style={{ width: '100%' }} onClick={() => handleOpenWorkout(inProgress.id)}>Continue →</button>
              </div>
            )}

            <button className="primary start-btn" onClick={handleStartEmptyWorkout}>Start New Workout</button>
            {workouts.some(w => w.status === 'finished') && (
              <button onClick={() => setShowTemplateSheet(true)}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
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
                }} style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px dashed var(--border)', background: 'transparent', color: todayRestDay ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', cursor: todayRestDay ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {todayRestDay ? <><IconCheck size={14} />Rest day logged</> : markingRestDay ? 'Logging…' : 'Mark as rest day'}
                </button>
              )
            })()}

            <div className="card">
              <p className="section-heading">This Week</p>
              <div className="stat-row">
                <div className="stat-box"><span className="stat-num">{thisWeekWorkouts.length}</span><span className="stat-label">workouts</span></div>
                <div className="stat-box"><span className="stat-num">{thisWeekSets}</span><span className="stat-label">sets</span></div>
                <div className="stat-box"><span className="stat-num">{streak}</span><span className="stat-label">day streak</span></div>
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
          <section>
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
                                  <button type="button" onClick={() => startEditExercise(ex)}
                                    style={{ background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.02em', flexShrink: 0, fontFamily: 'inherit' }}
                                    aria-label="Edit">Edit</button>
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
          <section>
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
                    {list.map(w => (
                      <li key={w.id} style={{ padding: '14px 0' }}>
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
          </section>
        )}

        {/* ─── PROGRESS ─── */}
        {activeTab === 'progress' && (
          <section>
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
                    const fill = entry === 'workout' ? 'var(--accent)' : entry === 'rest' ? '#57965c' : 'var(--bg-secondary)'
                    cells.push(<rect key={`${col}-${row}`} x={col*(cellSize+gap)} y={row*(cellSize+gap)} width={cellSize} height={cellSize} rx={2} fill={fill} opacity={isFuture ? 0.15 : 1} stroke={isToday ? 'var(--text)' : 'none'} strokeWidth={1.5} />)
                  }
                }
                return (
                  <div>
                    <svg width="100%" viewBox={`0 0 ${totalW} ${totalH}`} style={{ display: 'block' }}>{cells}</svg>
                    <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }}/>Workout</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#57965c' }}/>Rest day</div>
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
                  onClick={() => { setProgressRange(w); setVolumeLoaded(false); setDailyVolumeLoaded(false); setMuscleLoaded(false) }}
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
              {(progressRange === 'week' ? !dailyVolumeLoaded : !volumeLoaded) ? (
                <p className="muted">Loading…</p>
              ) : (() => {
                const chartData = progressRange === 'week' ? dailyVolumeData : volumeData
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
              {!muscleLoaded ? <p className="muted">Loading…</p> : (() => {
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

      <nav className="tabs">
        <button className={activeTab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
          <span className="tab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10.5z"/>
              <path d="M9 22V12h6v10"/>
            </svg>
          </span>
          <span className="tab-label">Home</span>
        </button>
        <button className={activeTab === 'exercises' ? 'active' : ''} onClick={() => setTab('exercises')}>
          <span className="tab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="10.5" width="4" height="3" rx="1"/>
              <rect x="18" y="10.5" width="4" height="3" rx="1"/>
              <rect x="6" y="8.5" width="3" height="7" rx="1"/>
              <rect x="15" y="8.5" width="3" height="7" rx="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
            </svg>
          </span>
          <span className="tab-label">Exercises</span>
        </button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
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
        <button className={activeTab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>
          <span className="tab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="12" width="4" height="9" rx="1"/>
              <rect x="10" y="7" width="4" height="14" rx="1"/>
              <rect x="17" y="3" width="4" height="18" rx="1"/>
            </svg>
          </span>
          <span className="tab-label">Progress</span>
        </button>
      </nav>

      {showTemplateSheet && (
        <BottomSheet onClose={() => setShowTemplateSheet(false)} maxHeight="80vh"
          dragZoneContent={
            <div style={{ padding: '10px 18px 6px' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Start from template</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>Pick a past workout to pre-load its exercises</div>
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
            {/* Scrollable body */
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Rename */}
              <div className="card" style={{ margin: 0 }}>
                <p className="section-heading">Name</p>
                <ProfileNameEditor profile={activeProfile} onSave={async name => {
                  const updated = await updateProfile(activeProfile.id, { name })
                  setActiveProfile(prev => ({ ...prev, name: updated.name }))
                }} />
              </div>
              {/* Units */}
              <div className="card" style={{ margin: 0 }}>
                <p className="section-heading">Units</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['kg', 'lbs'].map(u => (
                    <button key={u} type="button"
                      className={activeProfile.unit === u ? 'primary' : ''}
                      style={{ flex: 1 }}
                      onClick={async () => {
                        if (activeProfile.unit === u) return
                        const updated = await updateProfile(activeProfile.id, { unit: u })
                        setActiveProfile(prev => ({ ...prev, unit: updated.unit }))
                        setPrsLoaded(false)
                        // volume labels stay in kg server-side, converted on render — no reload needed
                      }}>{u}</button>
                  ))}
                </div>
              </div>
              {/* Theme */}
              <div className="card" style={{ margin: 0 }}>
                <p className="section-heading">Theme</p>
                <div className="theme-swatches">
                  {THEMES.map(t => (
                    <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <button type="button"
                        className={`theme-swatch${activeProfile.theme === t.id ? ' active' : ''}`}
                        style={{ background: t.color }} title={t.label}
                        onClick={async () => {
                          if (activeProfile.theme === t.id) return
                          const updated = await updateProfile(activeProfile.id, { theme: t.id })
                          setActiveProfile(prev => ({ ...prev, theme: updated.theme }))
                        }} />
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'center' }}>{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Avatar colour */}
              <div className="card" style={{ margin: 0 }}>
                <p className="section-heading">Avatar Colour</p>
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
              {/* Week start */}
              <div className="card" style={{ margin: 0 }}>
                <p className="section-heading">Week Starts On</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['monday','Monday'],['sunday','Sunday']].map(([val, label]) => (
                    <button key={val} type="button"
                      className={activeProfile.week_start === val ? 'primary' : ''}
                      style={{ flex: 1 }}
                      onClick={async () => {
                        if (activeProfile.week_start === val) return
                        const updated = await updateProfile(activeProfile.id, { week_start: val })
                        setActiveProfile(prev => ({ ...prev, week_start: updated.week_start }))
                      }}>{label}</button>
                  ))}
                </div>
              </div>
              {/* Workout */}
              <div className="card" style={{ margin: 0 }}>
                <p className="section-heading">Workout</p>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Default rest duration</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[60, 90, 120, 180].map(d => (
                      <button key={d} type="button"
                        className={(activeProfile.rest_duration || 90) === d ? 'primary' : ''}
                        style={{ flex: 1 }}
                        onClick={async () => {
                          if ((activeProfile.rest_duration || 90) === d) return
                          const updated = await updateProfile(activeProfile.id, { rest_duration: d })
                          setActiveProfile(prev => ({ ...prev, rest_duration: updated.rest_duration }))
                        }}>{d}s</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Timer ding sound</span>
                  <button type="button" onClick={async () => {
                    const next = !(activeProfile.ding_enabled !== false)
                    const updated = await updateProfile(activeProfile.id, { ding_enabled: next })
                    setActiveProfile(prev => ({ ...prev, ding_enabled: updated.ding_enabled }))
                  }} style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', padding: 2, background: activeProfile.ding_enabled !== false ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: activeProfile.ding_enabled !== false ? 'flex-end' : 'flex-start' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Progressive overload hint</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Suggest next weight during workouts</div>
                  </div>
                  <button type="button" onClick={async () => {
                    const next = !(activeProfile.overload_hints !== false)
                    const updated = await updateProfile(activeProfile.id, { overload_hints: next })
                    setActiveProfile(prev => ({ ...prev, overload_hints: updated.overload_hints }))
                  }} style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', padding: 2, background: activeProfile.overload_hints !== false ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: activeProfile.overload_hints !== false ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Plate calculator</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Show plates breakdown for barbell lifts</div>
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
              {/* Profile Password */}
              <div className="card" style={{ margin: 0 }}>
                <p className="section-heading">Profile Password</p>
                {activeProfile.has_pin ? (
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>Password is set. Required when selecting this profile.</div>
                    {pinSettingMode === 'change' ? (
                      <PinSetForm
                        onSave={async pw => {
                          const updated = await setPin(activeProfile.id, pw)
                          setActiveProfile(p => ({ ...p, has_pin: updated.has_pin }))
                          setPinSettingMode(null)
                        }}
                        onCancel={() => setPinSettingMode(null)}
                      />
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" style={{ flex: 1 }} onClick={() => setPinSettingMode('change')}>Change Password</button>
                        <button type="button" style={{ flex: 1, color: '#e06c75' }} onClick={async () => {
                          const updated = await setPin(activeProfile.id, null)
                          setActiveProfile(p => ({ ...p, has_pin: updated.has_pin }))
                        }}>Remove Password</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>No password set. Anyone can select this profile.</div>
                    {pinSettingMode === 'set' ? (
                      <PinSetForm
                        onSave={async pw => {
                          const updated = await setPin(activeProfile.id, pw)
                          setActiveProfile(p => ({ ...p, has_pin: updated.has_pin }))
                          setPinSettingMode(null)
                        }}
                        onCancel={() => setPinSettingMode(null)}
                      />
                    ) : (
                      <button type="button" style={{ width: '100%' }} onClick={() => setPinSettingMode('set')}>Set Password</button>
                    )}
                  </div>
                )}
              </div>
              {/* Export */}
              <div className="card" style={{ margin: 0 }}>
                <p className="section-heading">Export</p>
                <a href={`/api/profiles/${activeProfile.id}/export.csv`} download="lifty_export.csv" style={{ display: 'block' }}>
                  <button type="button" style={{ width: '100%' }}><IconDownload />Export CSV</button>
                </a>
              </div>
              {/* Import */}
              <div className="card" style={{ margin: 0 }}>
                <p className="section-heading">Import from Strong</p>
                <p className="muted" style={{ fontSize: '0.82rem', marginTop: 0, marginBottom: 10 }}>Select the CSV exported from the Strong app. Already imported workouts are skipped.</p>
                {importState && importState !== 'loading' && (
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '0.85rem' }}>
                    {importState.error
                      ? <span style={{ color: '#e06c75' }}><IconXCircle size={14} />{importState.error}</span>
                      : <span style={{ color: 'var(--accent)' }}><IconCheck size={14} />Imported {importState.imported_workouts} workout{importState.imported_workouts !== 1 ? 's' : ''} &middot; {importState.imported_sets} sets &middot; {importState.created_exercises} new exercise{importState.created_exercises !== 1 ? 's' : ''}{importState.skipped_workouts > 0 ? ` (${importState.skipped_workouts} skipped)` : ''}</span>
                    }
                  </div>
                )}
                <label style={{ display: 'block' }}>
                  <input type="file" accept=".csv" style={{ display: 'none' }}
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      e.target.value = ''
                      setImportState('loading')
                      try {
                        const result = await importStrong(file, activeProfile.id)
                        setImportState(result)
                        // Refresh workouts + exercises
                        const [ws, exs] = await Promise.all([
                          listWorkouts(activeProfile.id),
                          listExercises(activeProfile.id),
                        ])
                        setWorkouts(ws)
                        setExercises(exs)
                      } catch (err) {
                        setImportState({ error: 'Import failed. Check the file format.' })
                      }
                    }}
                  />
                  <button type="button" style={{ width: '100%', pointerEvents: 'none' }}
                    onClick={e => e.currentTarget.parentElement.querySelector('input').click()}
                    disabled={importState === 'loading'}>
                    {importState === 'loading' ? 'Importing…' : <><IconUpload />Import Strong CSV</>}
                  </button>
                </label>
              </div>
              {/* Switch profile */}
              <div className="card" style={{ margin: 0 }}>
                <button type="button" style={{ width: '100%' }} onClick={() => {
                  localStorage.removeItem('activeProfileId')
                  setActiveProfile(null)
                  setShowSettings(false)
                  setPinSettingMode(null)
                }}>Switch Profile</button>
              </div>
              {/* Danger zone */}
              <DangerZone profileId={activeProfile.id} onDeleted={async () => {
                const ws = await listWorkouts(activeProfile.id)
                setWorkouts(ws)
                setPrsLoaded(false)
              }} />
            </div>
        </BottomSheet>
      )}
    </div>
  )
}

// Reusable bottom sheet with swipe-to-dismiss and body scroll lock
function BottomSheet({ onClose, maxHeight = '90vh', zIndex = 100, dragZoneContent, children }) {
  const sheetRef = React.useRef(null)
  const handleRef = React.useRef(null)
  const dragRef = React.useRef({ startY: 0, dragging: false, currentY: 0 })
  const [dragY, setDragY] = React.useState(0)

  // Lock body scroll
  React.useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Swipe-to-dismiss on drag zone
  React.useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    function onTouchStart(e) {
      dragRef.current = { startY: e.touches[0].clientY, dragging: true, currentY: 0 }
    }
    function onTouchMove(e) {
      if (!dragRef.current.dragging) return
      const dy = e.touches[0].clientY - dragRef.current.startY
      if (dy > 0) { e.preventDefault(); dragRef.current.currentY = dy; setDragY(dy) }
    }
    function onTouchEnd() {
      if (!dragRef.current.dragging) return
      dragRef.current.dragging = false
      const dy = dragRef.current.currentY
      setDragY(0)
      if (dy > 80) onClose()
    }
    handle.addEventListener('touchstart', onTouchStart, { passive: true })
    handle.addEventListener('touchmove', onTouchMove, { passive: false })
    handle.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      handle.removeEventListener('touchstart', onTouchStart)
      handle.removeEventListener('touchmove', onTouchMove)
      handle.removeEventListener('touchend', onTouchEnd)
    }
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div ref={sheetRef}
        style={{ position: 'relative', background: 'var(--card)', borderRadius: '20px 20px 0 0', maxHeight, display: 'flex', flexDirection: 'column', transform: `translateY(${dragY}px)`, transition: dragY === 0 ? 'transform 0.25s ease' : 'none' }}
        onClick={e => e.stopPropagation()}>
        {/* Drag zone: pill + optional extra content (e.g. header, stats) */}
        <div ref={handleRef} style={{ touchAction: 'none' }}>
          <div style={{ textAlign: 'center', padding: '14px 0 0', cursor: 'grab' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', display: 'inline-block' }} />
          </div>
          {dragZoneContent}
        </div>
        {children}
      </div>
    </div>
  )
}

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
    <div style={{ margin: 0, border: '1px solid rgba(224,108,117,0.35)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="section-heading" style={{ color: '#e06c75', margin: 0 }}>Danger Zone</p>
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
              style={{ width: '100%', background: ready ? '#e06c75' : 'var(--bg-secondary)', color: ready ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed', opacity: busy ? 0.6 : 1, fontFamily: 'inherit', fontSize: '1rem', transition: 'background 0.15s' }}>
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

function inlineMarkdown(text, keyPrefix = '') {
  const parts = []
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[0].startsWith('**')) parts.push(<strong key={keyPrefix + m.index}>{m[2]}</strong>)
    else if (m[0].startsWith('*')) parts.push(<em key={keyPrefix + m.index}>{m[3]}</em>)
    else parts.push(<code key={keyPrefix + m.index} style={{ background: 'var(--bg-secondary)', borderRadius: 3, padding: '1px 4px', fontSize: '0.85em', fontFamily: 'monospace' }}>{m[4]}</code>)
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : text
}

function MiniMarkdown({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const end = lines.findIndex((l, j) => j > i && l.trimStart().startsWith('```'))
      const codeLines = end > i ? lines.slice(i + 1, end) : lines.slice(i + 1)
      elements.push(<pre key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 12px', margin: '4px 0', fontSize: '0.82rem', overflowX: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{codeLines.join('\n')}</pre>)
      i = end > i ? end + 1 : lines.length
      continue
    }
    if (line.startsWith('# ')) elements.push(<div key={i} style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 6, marginBottom: 2 }}>{inlineMarkdown(line.slice(2), String(i))}</div>)
    else if (line.startsWith('## ')) elements.push(<div key={i} style={{ fontWeight: 700, fontSize: '0.98rem', marginTop: 4 }}>{inlineMarkdown(line.slice(3), String(i))}</div>)
    else if (line.startsWith('### ')) elements.push(<div key={i} style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 3 }}>{inlineMarkdown(line.slice(4), String(i))}</div>)
    else if (line.startsWith('- ') || line.startsWith('* ')) elements.push(<div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 2 }}><span style={{ color: 'var(--accent)', flexShrink: 0 }}>·</span><span>{inlineMarkdown(line.slice(2), String(i))}</span></div>)
    else if (line.trim() === '') elements.push(<div key={i} style={{ height: 6 }} />)
    else elements.push(<div key={i} style={{ marginTop: 2, lineHeight: 1.6 }}>{inlineMarkdown(line, String(i))}</div>)
    i++
  }
  return <div style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.5 }}>{elements}</div>
}

function WorkoutDetailSheet({ workout, detail, exercises, unit, onClose }) {
  const COLORS = ['#e06c75','#61afef','#98c379','#c678dd','#e5c07b','#56b6c2','#ff9580','#bd93f9','#abb2bf']
  const BODY_PART_ORDER = ['Chest','Back','Legs','Shoulders','Arms','Core','Full Body','Cardio','Other']

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
          <button onClick={onClose} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 }}><IconX size={16} /></button>
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
              style={{ width: '100%', paddingRight: 44, marginBottom: 0, animation: pinError ? 'pinShake 0.4s ease' : 'none', borderColor: pinError ? '#e06c75' : undefined }}
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
              style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem', padding: 4, lineHeight: 1 }}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {pinError && <div style={{ color: '#e06c75', fontSize: '0.85rem', textAlign: 'center' }}>{pinError}</div>}
          {secsLeft > 0 && (
            <div style={{ color: '#e06c75', fontSize: '0.85rem', textAlign: 'center' }}>
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
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <Dumbbell size={48} strokeWidth={1.5} style={{ marginBottom: 8, color: 'var(--accent)' }} />
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>lifty</h1>
        <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '1rem' }}>Who's training today?</p>
      </div>

      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {profiles.map(p => (
          <button key={p.id} type="button" onClick={() => handleProfileClick(p)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', textAlign: 'left', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: p.avatar_color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
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
      {error && <div style={{ color: '#e06c75', fontSize: '0.82rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        <button type="submit" className="primary" style={{ flex: 1 }} disabled={saving}>
          {saving ? 'Saving…' : 'Save Password'}
        </button>
      </div>
    </form>
  )
}

function ActiveWorkoutView({ workout, exercises, sessionSets, onFinish, onCancel, onExit, onAddSet, onDeleteSet, onRename, onSaveNotes, unit = 'kg', restDuration: propRestDuration = 90, dingEnabled = true, onRestDurationChange, overloadHints = true, plateCalc = true }) {
  const BODY_PARTS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Full Body', 'Other']

  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (workout.status !== 'in_progress') return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [workout.status])
  function utcMsLocal(s) { return s ? new Date(s.endsWith('Z') ? s : s + 'Z').getTime() : null }
  const elapsed = workout.status === 'in_progress' && workout.start_time
    ? Math.max(0, Math.floor((Date.now() - utcMsLocal(workout.start_time)) / 1000))
    : 0

  const [finishing, setFinishing] = React.useState(false)
  const [cancelConfirm, setCancelConfirm] = React.useState(false)
  const [noteOpen, setNoteOpen] = React.useState(!!(workout.notes))
  const [noteText, setNoteText] = React.useState(workout.notes || '')
  const [editingName, setEditingName] = React.useState(false)
  const [draftName, setDraftName] = React.useState('')
  function startEditName() { setDraftName(workout.name); setEditingName(true) }
  function commitName() {
    setEditingName(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== workout.name) onRename?.(workout.id, trimmed)
  }
  const [selectedExId, setSelectedExId] = React.useState(null)
  const [showExPicker, setShowExPicker] = React.useState(false)
  const [exSearch, setExSearch] = React.useState('')
  const [reps, setReps] = React.useState('')
  const [weight, setWeight] = React.useState('')
  const [lastSetsByExId, setLastSetsByExId] = React.useState({})
  const [historySheet, setHistorySheet] = React.useState(null) // null | {exId, name, data}
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [restDuration, setRestDuration] = React.useState(propRestDuration)
  const [restLeft, setRestLeft] = React.useState(null)
  const [restRunning, setRestRunning] = React.useState(false)
  const restEndRef = React.useRef(null)

  async function openHistory(exId, exName) {
    setHistorySheet({ exId, name: exName, data: null })
    setHistoryLoading(true)
    try {
      const data = await getExerciseHistory(exId, workout.profile_id)
      setHistorySheet(s => s?.exId === exId ? { ...s, data } : s)
    } finally {
      setHistoryLoading(false)
    }
  }

  function scheduleSwNotif(delay) {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        id: 'rest-timer',
        delay,
        title: 'lifty',
        body: 'Rest done — time to lift!',
      })
    }
  }
  function cancelSwNotif() {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_NOTIFICATION', id: 'rest-timer' })
    }
  }

  function startRestTimer(dur) {
    restEndRef.current = Date.now() + dur * 1000
    setRestLeft(dur)
    setRestRunning(true)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    scheduleSwNotif(dur * 1000)
  }
  function stopRestTimer() { setRestLeft(null); setRestRunning(false); cancelSwNotif() }

  const exerciseIds = [...new Set(sessionSets.map(s => s.exercise_id))]
  if (selectedExId && !exerciseIds.includes(selectedExId)) exerciseIds.push(selectedExId)

  const setsByExercise = sessionSets.reduce((acc, s) => {
    acc[s.exercise_id] = acc[s.exercise_id] || []; acc[s.exercise_id].push(s); return acc
  }, {})

  const exIdsKey = exerciseIds.join(',')

  const [exerciseOrder, setExerciseOrder] = React.useState([])
  React.useEffect(() => {
    setExerciseOrder(prev => {
      const prevSet = new Set(prev)
      const toAdd = exerciseIds.filter(id => !prevSet.has(id))
      const filtered = prev.filter(id => exerciseIds.includes(id))
      return [...filtered, ...toAdd]
    })
  }, [exIdsKey])
  const orderedExIds = exerciseOrder.length ? exerciseOrder : exerciseIds
  function moveExercise(exId, dir) {
    setExerciseOrder(prev => {
      const idx = prev.indexOf(exId)
      if (idx === -1) return prev
      const swap = idx + dir
      if (swap < 0 || swap >= prev.length) return prev
      const next = [...prev];[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }
  React.useEffect(() => {
    exerciseIds.forEach(exId => {
      if (!(exId in lastSetsByExId)) {
        setLastSetsByExId(prev => ({ ...prev, [exId]: [] }))
        getExerciseLastSets(exId).then(sets => {
          setLastSetsByExId(prev => ({ ...prev, [exId]: sets || [] }))
        })
      }
    })
  }, [exIdsKey])

  React.useEffect(() => {
    if (!restRunning || !restEndRef.current) return

    function finish() {
      // Cancel the SW notification — page handled this finish
      cancelSwNotif()
      if (dingEnabled) playDing()
      if (navigator.vibrate) navigator.vibrate([300, 100, 300])
      setRestLeft(null)
      setRestRunning(false)
    }

    // Tick every 250ms — recomputes from absolute end time, handles finish itself
    const tickId = setInterval(() => {
      const left = Math.ceil((restEndRef.current - Date.now()) / 1000)
      if (left <= 0) {
        clearInterval(tickId)
        finish()
      } else {
        setRestLeft(left)
      }
    }, 250)

    // Correct immediately on resume from background
    function onVisible() {
      if (document.visibilityState !== 'visible' || !restEndRef.current) return
      const left = Math.ceil((restEndRef.current - Date.now()) / 1000)
      if (left <= 0) { clearInterval(tickId); finish() }
      else setRestLeft(left)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(tickId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [restRunning])

  function saveRestDuration(d) { setRestDuration(d); onRestDurationChange?.(d) }

  function activateExercise(exId) {
    setSelectedExId(exId)
    const sets = setsByExercise[exId] || []
    if (sets.length > 0) {
      // pre-fill from last SESSION set
      const last = sets[sets.length - 1]
      setReps(last.reps != null ? String(last.reps) : '')
      const dispW = last.weight != null ? (unit === 'lbs' ? Math.round(last.weight * 2.20462 * 10) / 10 : last.weight) : ''
      setWeight(dispW !== '' ? String(dispW) : '')
    } else {
      // try to pre-fill from last-time set 1 (may already be loaded, or effect will fill it when it loads)
      const prevSets = lastSetsByExId[exId] || []
      const prev = prevSets[0]
      if (prev) {
        const dispW = prev.weight != null ? (unit === 'lbs' ? Math.round(prev.weight * 2.20462 * 10) / 10 : prev.weight) : ''
        setWeight(dispW !== '' ? String(dispW) : '')
        setReps(prev.reps != null ? String(prev.reps) : '')
      } else {
        setReps(''); setWeight('')
      }
    }
  }

  // When lastSetsByExId loads async for a brand-new (no session sets) active exercise, auto-fill
  const _selectedLastSets = selectedExId ? lastSetsByExId[selectedExId] : undefined
  React.useEffect(() => {
    if (!selectedExId || !_selectedLastSets?.length) return
    const sessionSetsForEx = setsByExercise[selectedExId] || []
    if (sessionSetsForEx.length > 0) return // already logging, don't clobber
    if (weight !== '' || reps !== '') return // user already typed something
    const prev = _selectedLastSets[0]
    if (prev) {
      const dispW = prev.weight != null ? (unit === 'lbs' ? Math.round(prev.weight * 2.20462 * 10) / 10 : prev.weight) : ''
      setWeight(dispW !== '' ? String(dispW) : '')
      setReps(prev.reps != null ? String(prev.reps) : '')
    }
  }, [_selectedLastSets])

  // After each set is logged, pre-fill inputs for the next set from the last-time session
  const _activeSessionCount = selectedExId ? (setsByExercise[selectedExId] || []).length : 0
  React.useEffect(() => {
    if (!selectedExId || _activeSessionCount === 0) return
    const exLastSets = lastSetsByExId[selectedExId] || []
    const nextPrev = exLastSets[_activeSessionCount] // same-numbered set from last time
    if (nextPrev) {
      const dispW = nextPrev.weight != null ? (unit === 'lbs' ? Math.round(nextPrev.weight * 2.20462 * 10) / 10 : nextPrev.weight) : ''
      setWeight(dispW !== '' ? String(dispW) : '')
      setReps(nextPrev.reps != null ? String(nextPrev.reps) : '')
    } else {
      // No history for this set number — refill from the set just logged so the button stays enabled
      const lastLogged = (setsByExercise[selectedExId] || []).at(-1)
      if (lastLogged) {
        const dispW = lastLogged.weight != null ? (unit === 'lbs' ? Math.round(lastLogged.weight * 2.20462 * 10) / 10 : lastLogged.weight) : ''
        setWeight(dispW !== '' ? String(dispW) : '')
        setReps(lastLogged.reps != null ? String(lastLogged.reps) : '')
      }
    }
  }, [_activeSessionCount])

  async function handleLogSet() {
    if (!selectedExId || (!reps && !weight)) return
    const weightKg = weight ? parseWeight(weight, unit) : null
    const newSet = await onAddSet(selectedExId, reps, weightKg)
    if (newSet) {
      setWeight('')
      setReps('')
      startRestTimer(restDuration)
    }
  }

  const workoutTimer = workout.status === 'finished' && workout.start_time && workout.end_time
    ? (() => { const s = Math.floor((new Date(workout.end_time) - new Date(workout.start_time)) / 1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` })()
    : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  const restPct = restLeft !== null ? restLeft / restDuration : 0
  const setCount = sessionSets.length

  const filteredExercises = exercises.filter(ex =>
    !exSearch.trim() || ex.name.toLowerCase().includes(exSearch.trim().toLowerCase())
  )
  const grouped = filteredExercises.reduce((acc, ex) => {
    const key = ex.body_part || 'Other'; acc[key] = acc[key] || []; acc[key].push(ex); return acc
  }, {})
  const groupKeys = [
    ...BODY_PARTS.filter(p => grouped[p]?.length),
    ...Object.keys(grouped).filter(k => !BODY_PARTS.includes(k)).sort()
  ]

  const dw = kg => kg == null ? '—' : unit === 'lbs' ? Math.round(kg * 2.20462 * 10) / 10 : kg

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px 12px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <input
              autoFocus
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitName() } if (e.key === 'Escape') setEditingName(false) }}
              style={{ fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.2, width: '100%', background: 'var(--bg-secondary)', border: '2px solid var(--accent)', borderRadius: 8, padding: '2px 8px', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}
            />
          ) : (
            <div onClick={startEditName}
              title="Tap to rename"
              style={{ fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.2, cursor: 'text', borderRadius: 6, padding: '2px 4px 2px 0', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.name}</div>
          )}
          <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {workout.status === 'in_progress' ? <Timer size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> : <Flag size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />} {workoutTimer} &nbsp;·&nbsp; {setCount} set{setCount !== 1 ? 's' : ''}
          </div>
        </div>
        {workout.status === 'in_progress' && (
          <button className="primary" disabled={finishing}
            onClick={async () => { setFinishing(true); await onFinish(workout.id) }}
            style={{ whiteSpace: 'nowrap', padding: '10px 20px', borderRadius: 10, fontWeight: 700, opacity: finishing ? 0.6 : 1 }}>
            {finishing ? '…' : 'Finish'}
          </button>
        )}
        <button onClick={onExit}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}><IconX size={16} /></button>
      </div>

      {/* Cancel confirmation modal */}
      {cancelConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card" style={{ width: '100%', maxWidth: 360 }}>
            <p className="section-heading" style={{ marginTop: 0 }}>Cancel workout?</p>
            <p className="muted" style={{ marginBottom: 20 }}>This will delete the workout and all logged sets. This cannot be undone.</p>
            <div className="row">
              <button onClick={() => setCancelConfirm(false)} style={{ flex: 1 }}>Keep going</button>
              <button onClick={() => { setCancelConfirm(false); onCancel(workout.id) }}
                style={{ flex: 1, background: '#e55', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', cursor: 'pointer', fontWeight: 600 }}>Yes, cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Rest timer */}
      {restLeft !== null && (
        <div style={{ background: 'var(--accent)', color: '#fff', padding: '18px 16px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', opacity: 0.85, marginBottom: 4, textTransform: 'uppercase' }}>Rest</div>
          <div style={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, margin: '10px 0 12px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#fff', borderRadius: 2, width: `${restPct * 100}%`, transition: 'width 1s linear' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[60, 90, 120, 180].map(d => (
              <button key={d} onClick={() => { saveRestDuration(d); if (restRunning) startRestTimer(d) }}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.5)', background: restDuration === d ? '#fff' : 'transparent', color: restDuration === d ? 'var(--accent)' : '#fff', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                {d}s
              </button>
            ))}
            <button onClick={stopRestTimer}
              style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Main scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {workout.status === 'in_progress' && (
          <>
            {exerciseIds.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0 20px', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Tap <strong>Add Exercise</strong> below to get started
              </div>
            )}

            {orderedExIds.map((exId, exIdx) => {
              const ex = exercises.find(e => e.id == exId)
              const sets = setsByExercise[exId] || []
              const exLastSets = lastSetsByExId[exId] || []
              const isActive = selectedExId === exId
              const nextSetNum = sets.length + 1
              const prevForNext = sets.length > 0
                ? sets[sets.length - 1]
                : (exLastSets.length > 0 ? exLastSets[exLastSets.length - 1] : null)
              const showTable = sets.length > 0 || isActive

              return (
                <div key={exId} className="card" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>

                  {/* Exercise header */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '10px 10px 10px 16px', gap: 6 }}>
                    <button type="button" onClick={() => activateExercise(exId)}
                      style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', padding: 0, minWidth: 0 }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex?.name || `Exercise ${exId}`}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.82rem', flexShrink: 0, marginLeft: 8 }}>{sets.length} set{sets.length !== 1 ? 's' : ''}</span>
                    </button>
                    <button type="button" onClick={() => openHistory(exId, ex?.name || `Exercise ${exId}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <TrendingUp size={16} />
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                      <button type="button" onClick={() => moveExercise(exId, -1)} disabled={exIdx === 0}
                        style={{ background: 'none', border: 'none', cursor: exIdx === 0 ? 'default' : 'pointer', opacity: exIdx === 0 ? 0.2 : 0.6, padding: '2px 6px', lineHeight: 1, color: 'var(--text)', fontSize: '0.7rem' }}>
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6l5-5 5 5"/></svg>
                      </button>
                      <button type="button" onClick={() => moveExercise(exId, 1)} disabled={exIdx === orderedExIds.length - 1}
                        style={{ background: 'none', border: 'none', cursor: exIdx === orderedExIds.length - 1 ? 'default' : 'pointer', opacity: exIdx === orderedExIds.length - 1 ? 0.2 : 0.6, padding: '2px 6px', lineHeight: 1, color: 'var(--text)', fontSize: '0.7rem' }}>
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 2l5 5 5-5"/></svg>
                      </button>
                    </div>
                  </div>

                  {/* Overload hint */}
                  {overloadHints && exLastSets.length > 0 && (() => {
                    const best = exLastSets.reduce((b, s) => !b || (s.weight != null && s.weight > (b.weight ?? 0)) ? s : b, null)
                    if (!best || best.weight == null) return null
                    const suggestKg = unit === 'lbs' ? best.weight + 2.268 : best.weight + 2.5
                    const dispBest = unit === 'lbs' ? `${Math.round(best.weight * 2.20462 * 10) / 10} lbs` : `${best.weight} kg`
                    const dispSuggest = unit === 'lbs' ? `${Math.round(suggestKg * 2.20462 * 10) / 10} lbs` : `${suggestKg} kg`
                    return (
                      <div style={{ padding: '0 16px 8px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <TrendingUp size={11} />
                        <span>Last best: {dispBest} × {best.reps} — aim for <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{dispSuggest}</span></span>
                      </div>
                    )
                  })()}

                  {showTable && (
                    <div style={{ padding: '0 16px' }}>
                      {/* Column headers */}
                      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 64px 52px 28px', gap: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                        {['#', 'PREV', unit.toUpperCase(), 'REPS', ''].map((h, i) => (
                          <span key={i} style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: i >= 2 ? 'center' : 'left' }}>{h}</span>
                        ))}
                      </div>

                      {/* Logged set rows */}
                      {sets.map((s, idx) => {
                        const prev = exLastSets[idx]
                        return (
                          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 64px 52px 28px', gap: 6, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--muted)' }}>{idx + 1}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {prev ? `${dw(prev.weight)} × ${prev.reps}` : '—'}
                            </span>
                            <span style={{ fontSize: '0.95rem', fontWeight: 600, textAlign: 'center' }}>{dw(s.weight)}</span>
                            <span style={{ fontSize: '0.95rem', fontWeight: 600, textAlign: 'center' }}>{s.reps ?? '—'}</span>
                            <button type="button" onClick={() => onDeleteSet(workout.id, s.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}><IconX size={15} /></button>
                          </div>
                        )
                      })}

                      {/* Input row for active exercise */}
                      {isActive && (
                        <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 64px 52px 28px', gap: 6, alignItems: 'center', padding: '8px 0 10px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)' }}>{nextSetNum}</span>
                          <button type="button"
                            onClick={() => {
                              if (!prevForNext) return
                              const dispW = prevForNext.weight != null ? (unit === 'lbs' ? Math.round(prevForNext.weight * 2.20462 * 10) / 10 : prevForNext.weight) : ''
                              setWeight(dispW !== '' ? String(dispW) : '')
                              setReps(prevForNext.reps != null ? String(prevForNext.reps) : '')
                            }}
                            style={{ fontSize: '0.78rem', color: prevForNext ? 'var(--accent)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'none', border: 'none', padding: 0, cursor: prevForNext ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'inherit' }}>
                            {prevForNext ? `${dw(prevForNext.weight)} × ${prevForNext.reps}` : '—'}
                          </button>
                          <input type="number" inputMode="decimal" step="any" value={weight}
                            onChange={e => setWeight(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleLogSet()}
                            placeholder="—"
                            style={{ textAlign: 'center', padding: '7px 4px', fontSize: '16px', fontWeight: 600, margin: 0 }} />
                          <input type="number" inputMode="numeric" step="any" value={reps}
                            onChange={e => setReps(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleLogSet()}
                            placeholder="—"
                            style={{ textAlign: 'center', padding: '7px 4px', fontSize: '16px', fontWeight: 600, margin: 0 }} />
                          <button type="button" onClick={handleLogSet} disabled={!reps && !weight}
                            style={{ background: (!reps && !weight) ? 'var(--bg-secondary)' : 'var(--accent)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', opacity: (!reps && !weight) ? 0.35 : 1, flexShrink: 0 }}><IconCheck size={15} style={{ marginRight: 0, display: 'block' }} /></button>
                        </div>
                      )}
                      {/* Plate calculator */}
                      {isActive && plateCalc && (() => {
                        const wKg = parseWeight(weight, unit)
                        if (!wKg || wKg <= 0) return null
                        const BAR_KG = unit === 'lbs' ? 20.4116 : 20
                        const perSide = (wKg - BAR_KG) / 2
                        if (perSide <= 0) return null
                        const PLATES = unit === 'lbs'
                          ? [{ kg: 20.4116, lbl: '45' }, { kg: 15.8757, lbl: '35' }, { kg: 11.3398, lbl: '25' }, { kg: 4.5359, lbl: '10' }, { kg: 2.2680, lbl: '5' }, { kg: 1.1340, lbl: '2.5' }]
                          : [{ kg: 25, lbl: '25' }, { kg: 20, lbl: '20' }, { kg: 15, lbl: '15' }, { kg: 10, lbl: '10' }, { kg: 5, lbl: '5' }, { kg: 2.5, lbl: '2.5' }, { kg: 1.25, lbl: '1.25' }]
                        const chips = []
                        let rem = perSide
                        for (const plate of PLATES) {
                          const n = Math.floor(rem / plate.kg + 0.001)
                          if (n > 0) chips.push({ lbl: plate.lbl, n })
                          rem -= n * plate.kg
                        }
                        if (chips.length === 0) return null
                        return (
                          <div style={{ padding: '2px 0 10px', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>Plates/side:</span>
                            {chips.map(({ lbl, n }) => (
                              <span key={lbl} style={{ fontSize: '0.72rem', background: 'var(--bg-secondary)', borderRadius: 4, padding: '2px 6px', fontWeight: 600, color: 'var(--text)' }}>
                                {n}×{lbl}
                              </span>
                            ))}
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 2 }}>({unit === 'lbs' ? '45 lb' : '20 kg'} bar)</span>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Rest timer selector */}
                  {isActive && restLeft === null && sets.length > 0 && (
                    <div style={{ padding: '4px 16px 12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rest:</span>
                      {[60, 90, 120, 180].map(d => (
                        <button key={d} type="button" onClick={() => saveRestDuration(d)}
                          style={{ padding: '2px 8px', borderRadius: 6, border: restDuration === d ? '2px solid var(--accent)' : '1px solid var(--border)', background: restDuration === d ? 'var(--accent)' : 'transparent', color: restDuration === d ? '#fff' : 'var(--text)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
                          {d}s
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add Exercise */}
            <button type="button" onClick={() => setShowExPicker(true)}
              style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              ＋ Add Exercise
            </button>

            {/* Note */}
            {noteOpen ? (
              <div className="card" style={{ margin: 0, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</span>
                  <button type="button" onClick={() => setNoteOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><IconX size={15} /></button>
                </div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onBlur={() => onSaveNotes?.(workout.id, noteText)}
                  placeholder="Write a note… **bold**, *italic*, `code`, ## headings, - bullets"
                  rows={4}
                  style={{ width: '100%', resize: 'vertical', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: '16px', lineHeight: 1.55, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                />
                {noteText && <div style={{ marginTop: 8 }}><MiniMarkdown text={noteText} /></div>}
              </div>
            ) : (
              <button type="button" onClick={() => setNoteOpen(true)}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                + Add note
              </button>
            )}

            {/* Cancel Workout */}
            <button type="button" onClick={() => setCancelConfirm(true)}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'rgba(220,50,50,0.1)', color: '#e55', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel Workout
            </button>
          </>
        )}

        {workout.status === 'finished' && (
          <div className="card" style={{ margin: 0, padding: '24px 18px' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <CheckCircle2 size={48} strokeWidth={1.5} style={{ marginBottom: 8, color: 'var(--accent)' }} />
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>Workout complete</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{setCount} set{setCount !== 1 ? 's' : ''} · {workoutTimer}</div>
            </div>
            {Object.entries(setsByExercise).map(([exId, sets]) => {
              const ex = exercises.find(e => e.id == exId)
              return (
                <div key={exId} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 6, fontSize: '0.95rem' }}>{ex?.name || `Exercise ${exId}`}</div>
                  {sets.map((s, i) => (
                    <div key={s.id} style={{ fontSize: '0.9rem', color: 'var(--text-muted)', padding: '2px 0' }}>
                      {i + 1}. {dw(s.weight)} {unit} × {s.reps ?? '—'}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Exercise history bottom sheet */}
      {historySheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={() => setHistorySheet(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'relative', background: 'var(--card)', borderRadius: '20px 20px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', padding: '10px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', display: 'inline-block' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px 6px' }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{historySheet.name}</span>
              <button onClick={() => setHistorySheet(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center' }}><IconX size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 32px' }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading…</div>
              ) : !historySheet.data || historySheet.data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No history yet for this exercise.</div>
              ) : (() => {
                const pts = historySheet.data.filter(p => p.max_weight_kg != null)
                if (pts.length < 1) return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No weight data yet.</div>
                const W = 320, H = 150
                const pad = { top: 16, right: 12, bottom: 32, left: 40 }
                const plotW = W - pad.left - pad.right
                const plotH = H - pad.top - pad.bottom
                const weights = pts.map(p => unit === 'lbs' ? Math.round(p.max_weight_kg * 2.20462 * 10) / 10 : p.max_weight_kg)
                const minW = Math.min(...weights), maxW = Math.max(...weights)
                const range = maxW - minW || 1
                const n = pts.length
                const coords = pts.map((p, i) => ({
                  x: pad.left + (n < 2 ? plotW / 2 : (i / (n - 1)) * plotW),
                  y: pad.top + plotH - ((weights[i] - minW) / range) * plotH,
                  w: weights[i], date: p.date, sets: p.sets_count,
                }))
                const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
                const fmt = d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                return (
                  <>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 12 }}>
                      {[0, 0.5, 1].map(t => {
                        const y = pad.top + plotH - t * plotH
                        const val = minW + t * range
                        return (
                          <g key={t}>
                            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="var(--border)" strokeWidth="1" />
                            <text x={pad.left - 4} y={y + 4} fill="var(--text-muted)" fontSize="9" textAnchor="end">{Number.isInteger(val) ? val : val.toFixed(1)}</text>
                          </g>
                        )
                      })}
                      {n > 1 && <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
                      {coords.map((c, i) => (
                        <circle key={i} cx={c.x} cy={c.y} r="4" fill="var(--accent)" />
                      ))}
                      {n > 0 && <text x={coords[0].x} y={H - 4} fill="var(--text-muted)" fontSize="9" textAnchor="start">{fmt(pts[0].date)}</text>}
                      {n > 1 && <text x={coords[n - 1].x} y={H - 4} fill="var(--text-muted)" fontSize="9" textAnchor="end">{fmt(pts[n - 1].date)}</text>}
                    </svg>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>{unit === 'lbs' ? 'lbs' : 'kg'} — {pts.length} session{pts.length !== 1 ? 's' : ''}</div>
                    {[...historySheet.data].reverse().slice(0, 8).map((p, i) => {
                      const dispW = p.max_weight_kg == null ? '—' : unit === 'lbs' ? `${Math.round(p.max_weight_kg * 2.20462 * 10) / 10} lbs` : `${p.max_weight_kg} kg`
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span style={{ fontWeight: 600 }}>{p.sets_count} sets · best {dispW}</span>
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Exercise picker bottom sheet */}
      {showExPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={() => { setShowExPicker(false); setExSearch('') }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'relative', background: 'var(--card)', borderRadius: '20px 20px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', padding: '10px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', display: 'inline-block' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px 6px' }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Add Exercise</span>
              <button onClick={() => { setShowExPicker(false); setExSearch('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '0 16px 8px' }}>
              <input autoFocus placeholder="Search exercises…" value={exSearch}
                onChange={e => setExSearch(e.target.value)} style={{ margin: 0 }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
              {groupKeys.length === 0 && <div className="muted small" style={{ padding: '16px 0' }}>No exercises found</div>}
              {groupKeys.map(group => (
                <div key={group}>
                  <div style={{ padding: '10px 0 4px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group}</div>
                  {grouped[group].map(ex => (
                    <button key={ex.id}
                      onClick={() => { activateExercise(ex.id); setShowExPicker(false); setExSearch('') }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: 8, border: 'none', background: exerciseIds.includes(ex.id) ? 'var(--bg-secondary)' : 'transparent', cursor: 'pointer', marginBottom: 2, fontSize: '0.95rem', color: 'var(--text)', fontFamily: 'inherit' }}>
                      {ex.name}
                      {ex.equipment ? <span style={{ marginLeft: 8, fontSize: '0.82rem', color: 'var(--muted)' }}>({ex.equipment})</span> : null}
                      {exerciseIds.includes(ex.id) ? <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--accent)' }}>✓ added</span> : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
