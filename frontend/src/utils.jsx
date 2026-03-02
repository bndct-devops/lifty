import React from 'react'

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
export function IconDownload({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
export function IconUpload({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
}
export function IconCheck({ size = 14, style = {} }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5, ...style }}><polyline points="20 6 9 17 4 12"/></svg>
}
export function IconX({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
export function IconXCircle({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
}

// Two-tone bell synthesized via Web Audio (no audio file needed)
export function playDing() {
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

// Lightweight markdown renderer for workout notes
export function inlineMarkdown(text, keyPrefix = '') {
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

export function MiniMarkdown({ text }) {
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
