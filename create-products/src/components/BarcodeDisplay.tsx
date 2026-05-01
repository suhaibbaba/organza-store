'use client'
import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { Download } from 'lucide-react'

interface Props {
  value: string
  label?: string
}

export function BarcodeDisplay({ value, label }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !value) return
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 16,
        background: '#ffffff',
        lineColor: '#0f172a',
      })
    } catch { /* invalid barcode value */ }
  }, [value])

  const download = () => {
    const svg = svgRef.current
    if (!svg) return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      ctx.scale(2, 2)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, img.width, img.height)
      ctx.drawImage(img, 0, 0)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `barcode-${value}.png`
      a.click()
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  if (!value) return null

  return (
    <div className="flex flex-col items-center gap-4">
      {label && <p className="text-sm font-medium text-slate-700">{label}</p>}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm w-full max-w-xs">
        <svg ref={svgRef} className="w-full" />
      </div>
      <button
        onClick={download}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-all active:scale-95 shadow-sm"
      >
        <Download className="w-4 h-4" />
        Download PNG
      </button>
    </div>
  )
}
