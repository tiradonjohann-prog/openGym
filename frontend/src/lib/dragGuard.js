let _startX = 0, _startY = 0, _isDrag = false

export const dragGuard = {
  start(x, y)  { _startX = x; _startY = y; _isDrag = false },
  check(x, y)  { if (Math.hypot(x - _startX, y - _startY) > 5) _isDrag = true },
  get wasDrag() { return _isDrag },
}
