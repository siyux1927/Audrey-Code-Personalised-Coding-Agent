import React from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import { theme } from './theme.js'

export interface AgentTask {
  id: string
  label: string
  modelId: string
  status: 'running' | 'done' | 'failed'
}

interface Props { tasks: AgentTask[] }

export function AgentStatus({ tasks }: Props) {
  if (tasks.length === 0) return null
  return (
    <Box flexDirection="column" marginY={1}>
      <Text color={theme.purple}>◆ 正在并发执行 {tasks.length} 个子任务...</Text>
      {tasks.map(task => (
        <Box key={task.id} marginLeft={2}>
          {task.status === 'running' && <Text color={theme.purple}><Spinner type="dots" /></Text>}
          {task.status === 'done' && <Text color={theme.green}>✓</Text>}
          {task.status === 'failed' && <Text color={theme.red}>✗</Text>}
          <Text> </Text>
          <Text color={theme.dimPurple}>[{task.modelId}]</Text>
          <Text> {task.label}</Text>
          {task.status === 'done' && <Text color={theme.green}> 完成</Text>}
          {task.status === 'failed' && <Text color={theme.red}> 失败</Text>}
        </Box>
      ))}
    </Box>
  )
}
