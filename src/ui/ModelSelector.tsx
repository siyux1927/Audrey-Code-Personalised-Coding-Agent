import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from './theme.js'
import { MODELS, formatPrice, type ModelDef } from '../models.js'

interface Props {
  currentModelId?: string
  onSelect: (model: ModelDef) => void
  onCancel: () => void
}

export function ModelSelector({ currentModelId, onSelect, onCancel }: Props) {
  const [idx, setIdx] = useState(() => {
    const i = MODELS.findIndex(m => m.id === currentModelId)
    return i >= 0 ? i : 0
  })

  useInput((_input, key) => {
    if (key.upArrow) {
      setIdx(i => (i - 1 + MODELS.length) % MODELS.length)
      return
    }
    if (key.downArrow) {
      setIdx(i => (i + 1) % MODELS.length)
      return
    }
    if (key.return) {
      onSelect(MODELS[idx]!)
      return
    }
    if (key.escape) {
      onCancel()
      return
    }
  })

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.purple}>选择模型  </Text>
        <Text color={theme.dimPurple}>↑↓ 移动  Enter 确认  ESC 取消</Text>
      </Box>
      {MODELS.map((m, i) => {
        const selected = i === idx
        const isCurrent = m.id === currentModelId
        return (
          <Box key={m.id} paddingX={1}>
            <Text color={selected ? theme.pink : theme.dimPurple}>
              {selected ? '▶ ' : '  '}
            </Text>
            <Box flexDirection="column">
              <Box>
                <Text bold={selected} color={selected ? theme.purple : undefined}>
                  {m.displayName}
                </Text>
                {isCurrent && (
                  <Text color={theme.dimPurple}> (当前)</Text>
                )}
                <Text color={theme.dimPurple}>  {formatPrice(m)}</Text>
              </Box>
              <Text color={theme.dimPurple}>  {m.description}</Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
