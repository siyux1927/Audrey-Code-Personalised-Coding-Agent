import React from 'react'
import { Box, Text } from 'ink'
import { theme } from './theme.js'
import type { Message } from '../types.js'

interface Props { messages: Message[] }

export function MessageList({ messages }: Props) {
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <Box key={i} marginBottom={1} flexDirection="column">
          {msg.role === 'user' && (
            <Text color={theme.pink}>&gt; {msg.content}</Text>
          )}
          {msg.role === 'assistant' && (
            <Box flexDirection="column">
              <Text color={theme.purple}>◆ </Text>
              <Text>{msg.content}</Text>
            </Box>
          )}
          {msg.role === 'tool' && (
            <Text color={theme.dimPurple}>
              {'  '}[{msg.toolName}] {msg.content.slice(0, 100)}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  )
}
