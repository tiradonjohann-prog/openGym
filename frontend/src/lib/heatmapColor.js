// Gradient : bleu → vert → orange → rouge (identique à heatmapMat dans AnatomyModel)
// Retourne une couleur CSS hex pour un pourcentage d'activation 0-100.

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
}

function lerpHex(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1, 3), 16)
  const g1 = parseInt(hex1.slice(3, 5), 16)
  const b1 = parseInt(hex1.slice(5, 7), 16)
  const r2 = parseInt(hex2.slice(1, 3), 16)
  const g2 = parseInt(hex2.slice(3, 5), 16)
  const b2 = parseInt(hex2.slice(5, 7), 16)
  const r = lerp(r1, r2, t)
  const g = lerp(g1, g2, t)
  const b = lerp(b1, b2, t)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

export function heatmapColor(pct) {
  const t = Math.max(0, Math.min(1, pct / 100))
  if (t < 0.33) return lerpHex('#2255FF', '#00CC88', t / 0.33)
  if (t < 0.66) return lerpHex('#00CC88', '#FFAA00', (t - 0.33) / 0.33)
  return lerpHex('#FFAA00', '#FF2200', (t - 0.66) / 0.34)
}
