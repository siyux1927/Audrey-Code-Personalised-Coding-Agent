import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from './theme.js'

interface Props {
  onSubmit: (value: string) => void
  onAbort: () => void
  disabled?: boolean
}

export function Prompt({ onSubmit, onAbort, disabled }: Props) {
  const [value, setValue] = useState('')

  useInput((input, key) => {
    if (disabled) return
    if (key.escape) { onAbort(); return }
    if (key.return) {
      if (value.trim()) { onSubmit(value.trim()); setValue('') }
      return
    }
    if (key.backspace || key.delete) { setValue(v => v.slice(0, -1)); return }
    if (!key.ctrl && !key.meta) setValue(v => v + input)
  })

  return (
    <Box borderStyle="single" borderColor={theme.purple} paddingX={1}>
      <Text color={theme.pink}>&gt; </Text>
      <Text>{value}</Text>
      {!disabled && <Text color={theme.purple}>█</Text>}
    </Box>
  )
}
