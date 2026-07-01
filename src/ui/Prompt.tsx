import React, { useState, useRef } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from './theme.js'

interface Props {
  onSubmit: (value: string) => void
  onAbort: () => void
  disabled?: boolean
}

// Module-level: survives component unmount/remount (e.g. when model selector opens)
const persistentHistory: string[] = []

export function Prompt({ onSubmit, onAbort, disabled }: Props) {
  const [value, setValue] = useState('')
  const histIdx = useRef(-1)
  const savedInput = useRef('')  // preserves draft when browsing history

  useInput((input, key) => {
    if (disabled) return

    if (key.escape) { onAbort(); return }

    if (key.upArrow) {
      if (persistentHistory.length === 0) return
      if (histIdx.current === -1) savedInput.current = value   // save draft
      const next = Math.min(histIdx.current + 1, persistentHistory.length - 1)
      histIdx.current = next
      setValue(persistentHistory[next] ?? '')
      return
    }

    if (key.downArrow) {
      if (histIdx.current === -1) return
      const next = histIdx.current - 1
      histIdx.current = next
      setValue(next === -1 ? savedInput.current : persistentHistory[next] ?? '')
      return
    }

    if (key.return) {
      const trimmed = value.trim()
      if (!trimmed) return
      persistentHistory.unshift(trimmed)
      if (persistentHistory.length > 50) persistentHistory.pop()
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
