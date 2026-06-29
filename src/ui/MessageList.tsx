import React from 'react'
import { Box, Text } from 'ink'
import { theme } from './theme.js'
import { Markdown } from './Markdown.js'
import type { Message } from '../types.js'

interface Props { messages: Message[] }

export function MessageList({ messages }: Props) {
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <Box key={i} marginBottom={1} flexDirection="column">
          {msg.role === 'user' && (
            <Box>
              <Text color={theme.pink} bold>&gt; </Text>
              <Text color={theme.pink} wrap="wrap">{msg.content}</Text>
            </Box>
          )}
          {msg.role === 'assistant' && (
            <Box flexDirection="column">
              <Text color={theme.purple}>◆</Text>
              <Box marginLeft={2} flexDirection="column">
                <Markdown>{msg.content}</Markdown>
              </Box>
            </Box>
          )}
          {msg.role === 'tool' && msg.toolName === '__output__' && (
            <Text color={theme.dimPurple} wrap="wrap">{msg.content}</Text>
          )}
          {msg.role === 'tool' && msg.toolName !== '__output__' && msg.toolName !== '__btw__' && (
            <Box marginLeft={2}>
              <Text color={theme.dimPurple} dimColor>
                [{msg.toolName}] {msg.content.slice(0, 120)}{msg.content.length > 120 ? '…' : ''}
              </Text>
            </Box>
          )}
          {msg.role === 'tool' && msg.toolName === '__btw__' && (
            <Box>
              <Text color={theme.green}>📌 </Text>
              <Text color={theme.green}>{msg.content}</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}
