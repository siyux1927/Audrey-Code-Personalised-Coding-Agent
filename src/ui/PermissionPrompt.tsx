import React from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from './theme.js'

interface Props {
  toolName: string
  args: Record<string, unknown>
  onDecide: (allow: boolean) => void
}

export function PermissionPrompt({ toolName, args, onDecide }: Props) {
  const preview = JSON.stringify(args).slice(0, 120)

  useInput((input, key) => {
    if (input === 'y' || input === 'Y') { onDecide(true); return }
    if (input === 'n' || input === 'N' || key.escape) { onDecide(false); return }
  })

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.yellow} paddingX={1} marginY={1}>
      <Text color={theme.yellow}>⚠ Permission required</Text>
      <Text color={theme.dimPurple}>
        <Text color={theme.pink}>{toolName}</Text>
        {'  '}{preview}
      </Text>
      <Text color={theme.dimPurple}>Allow this tool call? <Text color={theme.purple}>[y/N]</Text></Text>
    </Box>
  )
}
