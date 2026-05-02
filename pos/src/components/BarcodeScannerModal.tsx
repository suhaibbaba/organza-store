import { useEffect, useRef, useState } from 'react'
import { IconAlertCircle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  opened: boolean
  onClose: () => void
  onScan: (code: string) => void
}

const SCANNER_ID = 'pos-camera-scanner'

export function BarcodeScannerModal({ opened, onClose, onScan }: Props) {
  const { t } = useTranslation()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!opened) return
    setError('')
    let cancelled = false

    const start = async () => {
      try {
        const html5Qrcode = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        })
        scannerRef.current = html5Qrcode
        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (w: number, h: number) => {
              const s = Math.floor(Math.min(w, h) * 0.8)
              return { width: s, height: Math.floor(s * 0.5) }
            },
            aspectRatio: 1.5,
          },
          (decoded) => { if (!cancelled) onScan(decoded) },
          () => {}
        )
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.toLowerCase().includes('permission')) setError(t('scanner.permissionDenied'))
        else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no camera')) setError(t('scanner.notFound'))
        else setError(msg)
      }
    }

    const timer = setTimeout(start, 100)
    return () => {
      cancelled = true
      clearTimeout(timer)
      const s = scannerRef.current
      if (s) { s.stop().then(() => s.clear()).catch(() => {}); scannerRef.current = null }
    }
  }, [opened, onScan, t])

  return (
    <Dialog open={opened} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('scanner.title')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('scanner.hint')}</p>
          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
              <IconAlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : (
            <div id={SCANNER_ID} className="w-full rounded-xl overflow-hidden" style={{ minHeight: 300 }} />
          )}
          <Button variant="outline" onClick={onClose} className="w-full">{t('scanner.cancel')}</Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
