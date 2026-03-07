import React from "react"
import { Check, CheckCircle2, Dumbbell, Flag, Lock, Repeat2, Timer, TrendingUp, Trophy } from "lucide-react"
import { fmtWeight, parseWeight, playDing, IconX, MiniMarkdown } from "./utils"
import { getExerciseLastSets, getExerciseHistory, subscribePush, schedulePush, cancelPush, reassignExercise } from "./api"

export default function ActiveWorkoutView({ workout, exercises, sessionSets, onFinish, onCancel, onExit, onAddSet, onDeleteSet, onReassign, onRename, onSaveNotes, unit = 'kg', restDuration: propRestDuration = 90, dingEnabled = true, onRestDurationChange, overloadHints = true, plateCalc = true, prs = [], liquidGlass = false, animationsEnabled = true }) {
  const BODY_PARTS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Full Body', 'Other']

  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (workout.status !== 'in_progress') return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [workout.status])

  // Keep screen awake during active workout
  React.useEffect(() => {
    if (workout.status !== 'in_progress') return
    let lock = null
    const acquire = async () => {
      try { lock = await navigator.wakeLock?.request('screen') } catch {}
    }
    acquire()
    const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release?.()
    }
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
  // Auto-select the last-worked exercise so the log row is ready on re-open
  const [selectedExId, setSelectedExId] = React.useState(() => {
    if (sessionSets.length > 0) return sessionSets[sessionSets.length - 1].exercise_id
    return null
  })
  const [showExPicker, setShowExPicker] = React.useState(false)
  const [swapExId, setSwapExId] = React.useState(null) // non-null = swap mode: exercise id being replaced
  const [exSearch, setExSearch] = React.useState('')
  const [reps, setReps] = React.useState('')
  const [weight, setWeight] = React.useState('')
  const [lastSetsByExId, setLastSetsByExId] = React.useState({})
  const [historySheet, setHistorySheet] = React.useState(null) // null | {exId, name, data}
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const REST_STEPS = import.meta.env.VITE_SHORT_TIMER ? [3, 5, 8, 10] : [60, 90, 120, 180]
  const [restDuration, setRestDuration] = React.useState(
    import.meta.env.VITE_SHORT_TIMER ? REST_STEPS[1] : propRestDuration
  )
  const [restLeft, setRestLeft] = React.useState(null)
  const [restRunning, setRestRunning] = React.useState(false)
  const restEndRef = React.useRef(null)
  const swipeTouchRef = React.useRef(null)
  const exSearchInputRef = React.useRef(null)
  const [logPulseActive, setLogPulseActive] = React.useState(false)
  const [prFlashExId, setPrFlashExId] = React.useState(null)
  const [notifPerm, setNotifPerm] = React.useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unavailable'
  )

  // Subscribe to web push if permission already granted (handles app updates)
  React.useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      subscribePush(workout?.profile_id).catch(() => {})
    }
  }, [workout?.profile_id])

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
    navigator.vibrate?.(20)
    restEndRef.current = Date.now() + dur * 1000
    setRestLeft(dur)
    setRestRunning(true)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        setNotifPerm(p)
        if (p === 'granted') subscribePush(workout?.profile_id).catch(() => {})
      }).catch(() => {})
    }
    scheduleSwNotif(dur * 1000)
    schedulePush(workout?.profile_id, dur * 1000, 'lifty', 'Rest done — time to lift!')
  }
  function stopRestTimer() {
    setRestLeft(null)
    setRestRunning(false)
    cancelSwNotif()
    cancelPush(workout?.profile_id)
  }

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
      // Page is alive so cancel both server push and SW timeout — ding handles it
      cancelPush(workout?.profile_id)
      cancelSwNotif()
      setRestLeft(null)
      setRestRunning(false)
      if (navigator.vibrate) navigator.vibrate([300, 100, 300])
      if (dingEnabled) playDing().catch(() => {})
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

  // Focus search input when exercise picker opens (autoFocus is unreliable on iOS Safari)
  React.useEffect(() => {
    if (showExPicker) {
      const t = setTimeout(() => exSearchInputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [showExPicker])

  async function handleLogSet() {
    if (!selectedExId || (!reps && !weight)) return
    const weightKg = weight ? parseWeight(weight, unit) : null
    const newSet = await onAddSet(selectedExId, reps, weightKg)
    if (newSet) {
      navigator.vibrate?.(30)
      setLogPulseActive(true)
      const repsNum = parseInt(reps)
      if (weightKg && repsNum >= 1) {
        const e1rm = repsNum > 1 ? Math.round(weightKg * (1 + 0.033 * repsNum) * 10) / 10 : weightKg
        const existingPr = prs.find(p => p.exercise_id === selectedExId)
        if (!existingPr || e1rm > existingPr.e1rm) {
          setPrFlashExId(selectedExId)
          setTimeout(() => setPrFlashExId(null), 3000)
        }
      }
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
    <div className={[liquidGlass ? 'liquid-glass' : '', animationsEnabled ? '' : 'no-anim'].filter(Boolean).join(' ') || undefined}
         style={{ minHeight: '100dvh', background: 'var(--bg)' }}
         onTouchStart={e => { swipeTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
         onTouchEnd={e => {
           if (!swipeTouchRef.current) return
           const dx = e.changedTouches[0].clientX - swipeTouchRef.current.x
           const dy = e.changedTouches[0].clientY - swipeTouchRef.current.y
           swipeTouchRef.current = null
           if (dx > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) onExit?.()
         }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: 'calc(14px + env(safe-area-inset-top)) 16px 12px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
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
          <div style={{ fontSize: '0.88rem', color: elapsed >= 7200 ? 'var(--danger)' : elapsed >= 5400 ? 'var(--warning)' : 'var(--text-muted)', marginTop: 4, fontVariantNumeric: 'tabular-nums', transition: 'color 2s ease' }}>
            {workout.status === 'in_progress' ? <Timer size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> : <Flag size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />} {workoutTimer} &nbsp;·&nbsp; {setCount} set{setCount !== 1 ? 's' : ''}
          </div>
        </div>
        {workout.status === 'in_progress' && (
          <button className="primary" disabled={finishing}
            onClick={async () => { setFinishing(true); await onFinish(workout.id) }}
            style={{ whiteSpace: 'nowrap', padding: '10px 20px', borderRadius: 10, fontWeight: 700, opacity: finishing ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {finishing ? '…' : <><CheckCircle2 size={16} strokeWidth={2.2} />Finish</>}
          </button>
        )}
        <button onClick={sessionSets.length === 0 ? () => onCancel(workout.id) : onExit}
          title={sessionSets.length === 0 ? 'Cancel workout' : 'Back to app'}
          style={{ background: sessionSets.length === 0 ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : 'var(--bg-secondary)', border: `1px solid ${sessionSets.length === 0 ? 'color-mix(in srgb, var(--danger) 35%, transparent)' : 'var(--border)'}`, color: sessionSets.length === 0 ? 'var(--danger)' : 'var(--text)', borderRadius: 8, padding: 0, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX size={16} /></button>
      </div>

      {/* Rest timer — sticky with header */}
      {restLeft !== null && (
        <div style={{ background: 'var(--accent)', color: '#fff', padding: '18px 16px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', opacity: 0.85, marginBottom: 4, textTransform: 'uppercase' }}>Rest</div>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
            </div>
            <div style={{ position: 'absolute', top: -4, right: -28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, pointerEvents: 'none' }}>
              {[0, 0.5, 1].map((delay, i) => (
                <span key={i} style={{
                  fontSize: `${0.75 + i * 0.12}rem`, fontWeight: 800, opacity: 0,
                  animation: `floatZ ${1.6 + i * 0.2}s ease-in-out ${delay}s infinite`,
                  marginTop: i === 0 ? 8 : -2,
                  marginLeft: [-4, 7, 1][i],
                }}>z</span>
              ))}
            </div>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, margin: '10px 0 12px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#fff', borderRadius: 2, width: `${restPct * 100}%`, transition: 'width 1s linear', animation: restLeft !== null && restLeft <= 10 ? 'restBarPulse 0.5s ease-in-out infinite' : 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {REST_STEPS.map(d => (
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
          {/* Notification permission status */}
          {notifPerm === 'default' && (
            <div onClick={() => Notification.requestPermission().then(p => setNotifPerm(p)).catch(() => {})}
              style={{ marginTop: 10, fontSize: '0.72rem', opacity: 0.85, cursor: 'pointer', textDecoration: 'underline' }}>
              Tap to enable alarm notification
            </div>
          )}
          {notifPerm === 'denied' && (
            <div style={{ marginTop: 10, fontSize: '0.72rem', opacity: 0.75 }}>
              Alarm notifications blocked — allow in browser settings
            </div>
          )}
        </div>
      )}
      </div>{/* end sticky wrapper */}

      {/* Cancel confirmation modal */}
      {cancelConfirm && (
        <div className="glass-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card glass-panel" style={{ width: '100%', maxWidth: 360 }}>
            <p className="section-heading" style={{ marginTop: 0 }}>Cancel workout?</p>
            <p className="muted" style={{ marginBottom: 20 }}>This will delete the workout and all logged sets. This cannot be undone.</p>
            <div className="row">
              <button onClick={() => setCancelConfirm(false)} style={{ flex: 1 }}>Keep going</button>
              <button onClick={() => { setCancelConfirm(false); onCancel(workout.id) }}
                style={{ flex: 1, background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', cursor: 'pointer', fontWeight: 600 }}>Yes, cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {workout.status === 'in_progress' && (
          <>
            {exerciseIds.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px 32px', gap: 14, textAlign: 'center' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                  border: '2px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'flamePulse 3s ease-in-out infinite',
                }}>
                  <Dumbbell size={32} color='var(--accent)' strokeWidth={1.8} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)', marginBottom: 6 }}>Ready when you are</div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Tap <span style={{ color: 'var(--accent)', fontWeight: 600 }}>+ Add Exercise</span> below<br />to build your first set
                  </div>
                </div>
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
                      <span style={{ color: 'var(--muted)', fontSize: '0.82rem', flexShrink: 0, marginLeft: 8, display: 'flex', alignItems: 'center', gap: 5 }}>{prFlashExId === exId && (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'var(--warning)', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: '0.65rem', fontWeight: 700, animation: 'prBadgePop 3s ease-in-out forwards', pointerEvents: 'none', whiteSpace: 'nowrap' }}><Trophy size={10} strokeWidth={2.5} />PR</span>)}{sets.length} set{sets.length !== 1 ? 's' : ''}</span>
                    </button>
                    <button type="button" onClick={() => openHistory(exId, ex?.name || `Exercise ${exId}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <TrendingUp size={16} />
                    </button>
                    <button type="button" title="Swap exercise" onClick={() => { setSwapExId(exId); setExSearch(''); setShowExPicker(true) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <Repeat2 size={16} />
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
                      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 64px 52px 32px', gap: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                        {['#', 'PREV', unit.toUpperCase(), 'REPS', ''].map((h, i) => (
                          <span key={i} style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: i >= 2 ? 'center' : 'left' }}>{h}</span>
                        ))}
                      </div>

                      {/* Logged set rows */}
                      {sets.map((s, idx) => {
                        const prev = exLastSets[idx]
                        const isOverload = s.weight != null && prev?.weight != null && s.weight > prev.weight
                        return (
                          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 64px 52px 32px', gap: 6, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)', borderRadius: 6, animation: isOverload ? 'overloadGlow 1.8s ease-out both' : 'none' }}>
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
                        <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 64px 52px 32px', gap: 6, alignItems: 'center', padding: '8px 0 10px' }}>
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
                            onFocus={e => e.target.select()}
                            onKeyDown={e => e.key === 'Enter' && handleLogSet()}
                            placeholder="—"
                            style={{ textAlign: 'center', padding: '7px 4px', fontSize: '16px', fontWeight: 600, margin: 0 }} />
                          <input type="number" inputMode="numeric" step="any" value={reps}
                            onChange={e => setReps(e.target.value)}
                            onFocus={e => e.target.select()}
                            onKeyDown={e => e.key === 'Enter' && handleLogSet()}
                            placeholder="—"
                            style={{ textAlign: 'center', padding: '7px 4px', fontSize: '16px', fontWeight: 600, margin: 0 }} />
                          <button type="button" onClick={handleLogSet} disabled={!reps && !weight}
                            style={{ background: (!reps && !weight) ? 'var(--bg-secondary)' : 'var(--accent)', border: 'none', borderRadius: 8, width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', opacity: (!reps && !weight) ? 0.35 : 1, flexShrink: 0, animation: logPulseActive ? 'setLogPulse 0.35s ease-out forwards' : 'none' }}
                            onAnimationEnd={() => setLogPulseActive(false)}><Check size={18} strokeWidth={2.5} /></button>
                        </div>
                      )}
                      {/* Plate calculator — barbell / trap bar / EZ bar only */}
                      {isActive && plateCalc && /barbell|trap bar|ez bar/i.test(ex.equipment || '') && (() => {
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
                      {REST_STEPS.map(d => (
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
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <IconX size={16} />Cancel Workout
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
            {orderedExIds.map(exId => {
              const sets = setsByExercise[exId] || []
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
          <div className="glass-overlay" style={{ position: 'absolute', inset: 0 }} />
          <div className="glass-panel" style={{ position: 'relative', borderRadius: '20px 20px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
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
          onClick={() => { setShowExPicker(false); setExSearch(''); setSwapExId(null) }}>
          <div className="glass-overlay" style={{ position: 'absolute', inset: 0 }} />
          <div className="glass-panel" style={{ position: 'relative', borderRadius: '20px 20px 0 0', maxHeight: '85dvh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', padding: '10px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', display: 'inline-block' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px 6px' }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{swapExId !== null ? 'Swap Exercise' : 'Add Exercise'}</span>
              <button onClick={() => { setShowExPicker(false); setExSearch(''); setSwapExId(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center' }}><IconX size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px' }}>
              {groupKeys.length === 0 && <div className="muted small" style={{ padding: '16px 0' }}>No exercises found</div>}
              {groupKeys.map(group => (
                <div key={group}>
                  <div style={{ padding: '10px 0 4px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group}</div>
                  {grouped[group].map(ex => (
                    <button key={ex.id}
                      onClick={async () => {
                        if (swapExId !== null) {
                          await onReassign?.(workout.id, swapExId, ex.id)
                          setSwapExId(null)
                        } else {
                          activateExercise(ex.id)
                        }
                        setShowExPicker(false)
                        setExSearch('')
                      }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: 8, border: 'none', background: exerciseIds.includes(ex.id) ? 'var(--bg-secondary)' : 'transparent', cursor: 'pointer', marginBottom: 2, fontSize: '0.95rem', color: 'var(--text)', fontFamily: 'inherit' }}>
                      {ex.name}
                      {ex.equipment ? <span style={{ marginLeft: 8, fontSize: '0.82rem', color: 'var(--muted)' }}>({ex.equipment})</span> : null}
                      {exerciseIds.includes(ex.id) ? <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--accent)' }}>✓ added</span> : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            {/* Search input at bottom so it sits just above the keyboard */}
            <div style={{ padding: '8px 16px calc(8px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)' }}>
              <input ref={exSearchInputRef} placeholder="Search exercises…" value={exSearch}
                onChange={e => setExSearch(e.target.value)} style={{ margin: 0 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
