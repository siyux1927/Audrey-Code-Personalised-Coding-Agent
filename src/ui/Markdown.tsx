import React from 'react'
import { Box, Text } from 'ink'
import { theme } from './theme.js'

interface Props { children: string }

export function Markdown({ children }: Props) {
  return <Box flexDirection="column">{renderBlocks(children)}</Box>
}

// ── Block rendering ────────────────────────────────────────────────────────────

function renderBlocks(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const codeRe = /```([\w]*)\n?([\s\S]*?)```/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null

  while ((m = codeRe.exec(text)) !== null) {
    if (m.index > last) nodes.push(...renderLines(text.slice(last, m.index), key++))
    nodes.push(renderCodeBlock(m[1] ?? '', m[2] ?? '', key++))
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(...renderLines(text.slice(last), key++))
  return nodes
}

function renderLines(text: string, baseKey: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const lines = text.split('\n')
  let key = baseKey * 1000
  let listBuf: { text: string; ordered: boolean; idx: number }[] = []

  function flushList() {
    if (!listBuf.length) return
    nodes.push(
      <Box key={key++} flexDirection="column" marginLeft={2}>
        {listBuf.map((item, i) => (
          <Box key={i}>
            <Text color={theme.purple}>{item.ordered ? `${item.idx}.` : '•'} </Text>
            <Box flexShrink={1}><Text wrap="wrap">{parseInline(item.text)}</Text></Box>
          </Box>
        ))}
      </Box>,
    )
    listBuf = []
  }

  for (const line of lines) {
    // Heading
    const hm = line.match(/^(#{1,3}) (.+)/)
    if (hm) {
      flushList()
      const lvl = hm[1].length
      const colors = [theme.pink, theme.purple, theme.dimPurple] as const
      nodes.push(<Text key={key++} bold color={colors[lvl - 1]}>{hm[2]}</Text>)
      continue
    }
    // Ordered list
    const om = line.match(/^(\d+)\. (.+)/)
    if (om) { listBuf.push({ text: om[2], ordered: true, idx: parseInt(om[1]) }); continue }
    // Unordered list
    const um = line.match(/^[-*+] (.+)/)
    if (um) { listBuf.push({ text: um[1], ordered: false, idx: 0 }); continue }

    flushList()

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <Box key={key++} flexDirection="row">
          <Text color={theme.dimPurple}>│ </Text>
          <Text color={theme.dimPurple} italic>{line.slice(2)}</Text>
        </Box>,
      )
      continue
    }
    // HR
    if (/^-{3,}$|^\*{3,}$/.test(line.trim())) {
      nodes.push(<Text key={key++} color={theme.dimPurple}>{'─'.repeat(60)}</Text>)
      continue
    }
    // Empty line
    if (line.trim() === '') { nodes.push(<Text key={key++}>{' '}</Text>); continue }
    // Paragraph
    nodes.push(<Text key={key++} wrap="wrap">{parseInline(line)}</Text>)
  }

  flushList()
  return nodes
}

// ── Inline parsing ─────────────────────────────────────────────────────────────

function parseInline(text: string): React.ReactNode {
  // Pattern order matters: bold before italic, avoid greedy overlap
  const re = /(\*\*[^*\n]+?\*\*|`[^`\n]+?`|\*[^*\n]+?\*|__[^_\n]+?__)/g
  const parts: React.ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<Text key={key++}>{text.slice(last, m.index)}</Text>)
    const s = m[0]
    if (s.startsWith('**') || s.startsWith('__')) {
      parts.push(<Text key={key++} bold>{s.slice(2, -2)}</Text>)
    } else if (s.startsWith('`')) {
      parts.push(<Text key={key++} color={theme.green} bold>{s.slice(1, -1)}</Text>)
    } else if (s.startsWith('*')) {
      parts.push(<Text key={key++} italic>{s.slice(1, -1)}</Text>)
    }
    last = m.index + s.length
  }
  if (last < text.length) parts.push(<Text key={key++}>{text.slice(last)}</Text>)
  return <>{parts}</>
}

// ── Code block ─────────────────────────────────────────────────────────────────

function renderCodeBlock(lang: string, code: string, key: number): React.ReactNode {
  const lines = code.replace(/\n$/, '').split('\n')
  return (
    <Box key={key} flexDirection="column" borderStyle="round" borderColor={theme.dimPurple} marginY={1} paddingX={1}>
      {lang && <Text color={theme.dimPurple} dimColor>{lang}</Text>}
      {lines.map((line, i) => (
        <Text key={i}>{renderCodeLine(line, lang)}</Text>
      ))}
    </Box>
  )
}

function renderCodeLine(line: string, lang: string): React.ReactNode {
  const hl = ['js', 'ts', 'javascript', 'typescript', 'tsx', 'jsx', 'py', 'python', 'bash', 'sh', 'zsh']
  if (!hl.includes(lang.toLowerCase())) return <Text>{line}</Text>
  const spans = tokenize(line, lang)
  return (
    <>
      {spans.map((s, i) => (
        <Text key={i} color={s.color} bold={s.bold}>{s.text}</Text>
      ))}
    </>
  )
}

// ── Syntax tokenizer ───────────────────────────────────────────────────────────

type Span = { text: string; color?: string; bold?: boolean }

const JS_KW = new Set([
  'const','let','var','function','class','return','if','else','for','while','do',
  'switch','case','break','continue','new','this','async','await','import','export',
  'from','default','typeof','instanceof','null','undefined','true','false',
  'interface','type','extends','implements','super','static','readonly',
  'public','private','protected','abstract','enum','try','catch','finally',
  'throw','in','of','yield','delete','void','as','namespace','declare','module',
])
const PY_KW = new Set([
  'def','class','import','from','return','if','elif','else','for','while','with',
  'as','try','except','finally','raise','True','False','None','and','or','not',
  'in','is','lambda','pass','break','continue','yield','async','await','global','nonlocal',
])

function tokenize(line: string, lang: string): Span[] {
  const kw = ['py','python'].includes(lang.toLowerCase()) ? PY_KW : JS_KW
  const spans: Span[] = []
  let i = 0

  while (i < line.length) {
    const ch = line[i]

    // Single-line comment
    if (ch === '/' && line[i + 1] === '/') {
      spans.push({ text: line.slice(i), color: theme.dimPurple }); break
    }
    if ((ch === '#') && ['py','python','bash','sh','zsh'].includes(lang.toLowerCase())) {
      spans.push({ text: line.slice(i), color: theme.dimPurple }); break
    }

    // String literals
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < line.length && line[j] !== ch) { if (line[j] === '\\') j++; j++ }
      j++
      spans.push({ text: line.slice(i, j), color: theme.green })
      i = j; continue
    }

    // Number
    if (/\d/.test(ch) && (i === 0 || /\W/.test(line[i - 1]))) {
      let j = i
      while (j < line.length && /[\d._xXa-fA-F]/.test(line[j])) j++
      spans.push({ text: line.slice(i, j), color: theme.yellow })
      i = j; continue
    }

    // Identifier / keyword
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++
      const word = line.slice(i, j)
      spans.push(kw.has(word)
        ? { text: word, color: theme.purple, bold: true }
        : { text: word })
      i = j; continue
    }

    // Whitespace
    if (/\s/.test(ch)) {
      let j = i
      while (j < line.length && /\s/.test(line[j])) j++
      spans.push({ text: line.slice(i, j) })
      i = j; continue
    }

    // Operators / punctuation
    spans.push({ text: ch, color: theme.pink })
    i++
  }

  return spans
}
