export function WaitingRoomPreview() {
  return (
    <div className="teach-card waiting-room" data-testid="waiting-room-preview">
      <h3 className="teach-card__title">What Porter serves</h3>
      <p className="meta">A plain page the server never caches. Your place in line is text. It checks a cheap ready flag, not the grades query.</p>
      <div className="waiting-room__frame">
        <h4>Grades line</h4>
        <p className="waiting-room__pos" aria-live="polite">
          You are in position 14.
        </p>
        <p>Rough wait: about 2 minutes.</p>
        <p className="meta">Poll every 1500ms + jitter. Grades load only when you open them.</p>
        <p>
          Ready: <span>not yet</span>
        </p>
        <p>
          <span className="waiting-room__btn">Open grades</span>
        </p>
        <p>
          <span className="waiting-room__btn waiting-room__btn--ghost">Try anyway</span>
          <span className="meta"> (small side lane, tighter limit)</span>
        </p>
      </div>
    </div>
  )
}
