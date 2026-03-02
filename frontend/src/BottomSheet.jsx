import React from 'react'

export default function BottomSheet({ onClose, maxHeight = '90vh', zIndex = 100, dragZoneContent, children }) {
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
      <div className="glass-overlay" style={{ position: 'absolute', inset: 0 }} />
      <div ref={sheetRef}
        className="glass-panel"
        style={{ position: 'relative', borderRadius: '20px 20px 0 0', maxHeight, display: 'flex', flexDirection: 'column', transform: `translateY(${dragY}px)`, transition: dragY === 0 ? 'transform 0.25s ease' : 'none' }}
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
