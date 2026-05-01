// ── SKU Generator ─────────────────────────────────────────────
function abbr(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase()
}

function titleCode(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 1) return abbr(words[0])
  return words.slice(0, 3).map(w => w[0].toUpperCase()).join('')
}

function rand4(seed: string): string {
  // Deterministic 4-digit number from seed string
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return String(Math.abs(hash) % 9000 + 1000)
}

export function generateSKU(title: string, optionValues: string[]): string {
  const parts = [titleCode(title), ...optionValues.map(abbr)]
  const base = parts.join('-')
  return `${base}-${rand4(base)}`
}

// ── EAN-13 Generator ──────────────────────────────────────────
function ean13CheckDigit(digits12: string): number {
  const sum = digits12.split('').reduce((acc, d, i) => {
    return acc + parseInt(d) * (i % 2 === 0 ? 1 : 3)
  }, 0)
  return (10 - (sum % 10)) % 10
}

export function generateBarcode(seed: string): string {
  // Deterministic 12-digit prefix from seed
  let hash = 5381
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0
  }
  const abs = Math.abs(hash)
  const raw = String(abs).padStart(12, '0').slice(0, 12)
  const check = ean13CheckDigit(raw)
  return raw + check
}
