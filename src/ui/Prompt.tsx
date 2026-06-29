import React, { useState, useRef } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from './theme.js'

interface Props {
  onSubmit: (value: string) => void
  onAbort: () => void
  disabled?: boolean
}

export function Prompt({ onSubmit, onAbort, disabled }: Props) {
  const [value, setValue] = useState('')
  const history = useRef<string[]>([])
  const histIdx = useRef(-1)
  const savedInput = useRef('')  // preserves draft when browsing history

  useInput((input, key) => {
    if (disabled) return

    if (key.escape) { onAbort(); return }

    if (key.upArrow) {
      const hist = history.current
      if (hist.length === 0) return
      if (histIdx.current === -1) savedInput.current = value   // save draft
      const next = Math.min(histIdx.current + 1, hist.length - 1)
      histIdx.current = next
      setValue(hist[next] ?? '')
      return
    }

    if (key.downArrow) {
      if (histIdx.current === -1) return
      const next = histIdx.current - 1
      histIdx.current = next
      setValue(next === -1 ? savedInput.current : history.current[next] ?? '')
      return
    }

    if (key.return) {
      const trimmed = value.trim()
      if (!trimmed) return
      history.current = [trimmed, ...history.current.slice(0, 99)]
      histIdx.current = -1
      savedInput.current = ''
      onSubmit(trimmed)
      setValue('')
      return
    }

    if (key.backspace || key.delete) {
      setValue(v => v.slice(0, -1))
      histIdx.current = -1
      return
    }

    if (!key.ctrl && !key.meta && input) {
      setValue(v => v + input)
      histIdx.current = -1
    }
  })

  return (
    <Box borderStyle="single" borderColor={theme.purple} paddingX={1}>
      <Text color={theme.pink}>&gt; </Text>
      <Text>{value}</Text>
      {!disabled && <Text color={theme.purple}>█</Text>}
    </Box>
  )
}
