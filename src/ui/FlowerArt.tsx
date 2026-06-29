import React from 'react'
import { Box, Text } from 'ink'
import { theme } from './theme.js'

interface Props { version: string; tagline: string }

export function FlowerArt({ version, tagline }: Props) {
  return (
    <Box flexDirection="column" alignItems="flex-start">
      <Box>
        <Box flexDirection="column" marginRight={2}>
          <Text>
            {'  '}
            <Text color={theme.pink}>▓</Text>
            <Text color={theme.purple}>░</Text>
            <Text color={theme.pink}>▓</Text>
            {'  '}
            <Text color={theme.purple}>░</Text>
            <Text color={theme.pink}>▓</Text>
            <Text color={theme.purple}>░</Text>
          </Text>
          <Text>
            {' '}
            <Text color={theme.purple}>░</Text>
            <Text color={theme.pink}>███</Text>
            <Text color={theme.purple}>░</Text>
            {' '}
            <Text color={theme.pink}>▓</Text>
            <Text color={theme.purple}>███</Text>
            <Text color={theme.pink}>▓</Text>
          </Text>
          <Text>
            {'  '}
            <Text color={theme.pink}>▓</Text>
            <Text color={theme.purple}>░</Text>
            <Text color={theme.pink}>▓</Text>
            {'  '}
            <Text color={theme.purple}>░</Text>
            <Text color={theme.pink}>▓</Text>
            <Text color={theme.purple}>░</Text>
          </Text>
          <Text>
            {'    '}
            <Text color={theme.green}>╲ ╱</Text>
          </Text>
          <Text>
            {'     '}
            <Text color={theme.green}>█</Text>
          </Text>
        </Box>
        <Box flexDirection="column" justifyContent="center">
          <Text bold color={theme.purple}>
            Audrey Code <Text color={theme.dimPurple}>{version}</Text>
          </Text>
          <Text color={theme.pink} italic>{tagline}</Text>
        </Box>
      </Box>
    </Box>
  )
}
