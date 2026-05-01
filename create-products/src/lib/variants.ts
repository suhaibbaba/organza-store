import type { LocalOption, LocalVariant } from '@/types'
import { generateSKU, generateBarcode } from './sku'

// Cartesian product of option values
function cartesian(arrays: string[][]): string[][] {
  return arrays.reduce<string[][]>(
    (acc, curr) => acc.flatMap(a => curr.map(b => [...a, b])),
    [[]]
  )
}

export function generateVariants(
  title: string,
  options: LocalOption[],
  price: number,
  existingVariants: LocalVariant[] = []
): LocalVariant[] {
  const filled = options.filter(o => o.values.length > 0)
  if (filled.length === 0) return []

  const combos = cartesian(filled.map(o => o.values))

  return combos.map(combo => {
    const optionValues: Record<string, string> = {}
    filled.forEach((opt, i) => { optionValues[opt.title] = combo[i] })

    const key = combo.join('|')
    const existing = existingVariants.find(v => v.key === key)

    const sku = existing?.sku || generateSKU(title, combo)
    const barcode = existing?.barcode || generateBarcode(sku)

    return {
      key,
      optionValues,
      sku,
      barcode,
      stock: existing?.stock ?? 1,
      price: existing?.price ?? price,
    }
  })
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
