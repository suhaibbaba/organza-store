'use client'
import { useRef, useState } from 'react'
import { Camera, Upload, X, Loader } from 'lucide-react'
import { uploadFile } from '@/lib/api'
import { toast } from 'sonner'

interface Props {
  currentUrl?: string | null
  onUploaded: (url: string) => void
}

export function ImageUpload({ currentUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl || null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return }
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)
    try {
      const url = await uploadFile(file)
      onUploaded(url)
      toast.success('Image uploaded')
    } catch {
      toast.error('Upload failed')
      setPreview(currentUrl || null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Preview */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className="relative w-full aspect-square max-w-[200px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors"
      >
        {preview ? (
          <>
            <img src={preview} alt="Product" className="w-full h-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <Loader className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            )}
            {!uploading && (
              <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                <Camera className="w-8 h-8 text-white" />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Upload className="w-8 h-8" />
            <span className="text-xs">Tap to upload</span>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
          {preview ? 'Change' : 'Upload'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={() => { setPreview(null); onUploaded('') }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}
