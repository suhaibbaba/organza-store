import { Modal, Stack, Text, Button, Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

interface Props {
  opened: boolean
  onClose: () => void
  onScan: (code: string) => void
}

const SCANNER_ID = 'pos-camera-scanner'

export function BarcodeScannerModal({ opened, onClose, onScan }: Props) {
  const { t } = useTranslation()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!opened) return

    setError('')
    let cancelled = false

    const start = async () => {
      try {
        // Create scanner only when the div exists
        const html5Qrcode = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        })
        scannerRef.current = html5Qrcode

        // Prefer environment (back) camera on phones
        const cameraConfig = { facingMode: 'environment' as const }
        const scanConfig = {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
            const size = Math.floor(minEdge * 0.8)
            return { width: size, height: Math.floor(size * 0.5) }
          },
          aspectRatio: 1.5,
        }

        await html5Qrcode.start(
          cameraConfig,
          scanConfig,
          (decoded) => {
            if (!cancelled) {
              onScan(decoded)
            }
          },
          () => { /* per-frame decode errors — ignore */ },
        )
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.toLowerCase().includes('permission')) {
          setError(t('scanner.permissionDenied'))
        } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no camera')) {
          setError(t('scanner.notFound'))
        } else {
          setError(msg)
        }
      }
    }

    // Small delay so the DOM node for the scanner is mounted
    const timer = setTimeout(start, 100)

    return () => {
      cancelled = true
      clearTimeout(timer)
      const s = scannerRef.current
      if (s) {
        s.stop().then(() => s.clear()).catch(() => { /* ignore */ })
        scannerRef.current = null
      }
    }
  }, [opened, onScan, t])

  return (
    <Modal opened={opened} onClose={onClose} title={t('scanner.title')} size="md" centered>
      <Stack>
        <Text size="sm" c="dimmed">{t('scanner.hint')}</Text>

        {error ? (
          <Alert icon={<IconAlertCircle size={16} />} color="red">{error}</Alert>
        ) : (
          <div id={SCANNER_ID} style={{ width: '100%', minHeight: 300, borderRadius: 8, overflow: 'hidden' }} />
        )}

        <Button variant="default" onClick={onClose} fullWidth>{t('scanner.cancel')}</Button>
      </Stack>
    </Modal>
  )
}
