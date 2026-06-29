import type { Session } from './session.js'
import type { IProvider } from '../providers/base.js'
import type { Message } from '../types.js'

export async function compact(session: Session, provider: IProvider): Promise<Session> {
  if (session.messages.length < 4) return session

  const head = session.messages.slice(0, 2)
  const tail = session.messages.slice(-2)
  const middle = session.messages.slice(2, -2)

  const summaryPrompt: Message = {
    role: 'user',
    content:
      'Summarize the following conversation in concise bullet points (max 300 words), ' +
      'preserving key decisions, file paths mentioned, and errors encountered:\n\n' +
      middle.map(m => `${m.role}: ${m.content}`).join('\n'),
  }

  let summary = ''
  for await (const chunk of provider.chat([summaryPrompt])) {
    summary += chunk
  }

  const summaryMsg: Message = {
    role: 'assistant',
    content: `[Context compacted]\n${summary}`,
  }

  return { ...session, messages: [...head, summaryMsg, ...tail] }
}
