import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text, fromLang, toLang } = await req.json()

  if (!text?.trim()) return NextResponse.json({ translated: '' })

  const langPair = `${fromLang}|${toLang}`
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${langPair}`

  const res = await fetch(url)
  if (!res.ok) return NextResponse.json({ error: 'Translation service unavailable' }, { status: 502 })

  const data = await res.json()

  if (data.responseStatus !== 200) {
    return NextResponse.json({ error: data.responseDetails || 'Translation failed' }, { status: 500 })
  }

  const translated = data.responseData?.translatedText || ''
  return NextResponse.json({ translated })
}
