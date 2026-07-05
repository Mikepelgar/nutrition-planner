import { useState, useRef, useEffect } from 'react'

/**
 * Drives a single streamed AI response (weekly review, meal plan). Reuses the
 * main→renderer `ai:chunk`/`ai:done`/`ai:error` channels, filtered by messageId.
 */
export function useAiStream() {
  const [text, setText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const cleanupRef = useRef<Array<() => void>>([])

  function cleanup() {
    cleanupRef.current.forEach((f) => f())
    cleanupRef.current = []
  }

  function run(invoke: (messageId: string) => Promise<void>) {
    const id = `m_${Date.now()}`
    setText('')
    setStreaming(true)
    cleanup()
    const offChunk = window.api.onAiChunk(({ messageId, chunk }) => {
      if (messageId === id) setText((t) => t + chunk)
    })
    const offDone = window.api.onAiDone(({ messageId }) => {
      if (messageId === id) setStreaming(false)
    })
    const offErr = window.api.onAiError(({ messageId, message }) => {
      if (messageId === id) {
        setText((t) => t || `⚠️ ${message}`)
        setStreaming(false)
      }
    })
    cleanupRef.current = [offChunk, offDone, offErr]
    invoke(id).catch((e: unknown) => {
      setText(`⚠️ ${(e as Error).message}`)
      setStreaming(false)
    })
  }

  useEffect(() => cleanup, [])
  return { text, streaming, run }
}
