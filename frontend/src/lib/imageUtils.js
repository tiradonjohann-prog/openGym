export async function pickImage() {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async e => {
      const file = e.target.files?.[0]
      if (!file) { resolve(null); return }
      resolve(await compressImage(file))
    }
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

async function compressImage(file, maxW = 800, maxH = 500, quality = 0.75) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width, maxH / img.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

// Returns true only for user-picked images (base64) — not bundled asset paths
export const isUserImage = url => typeof url === 'string' && url.startsWith('data:')
