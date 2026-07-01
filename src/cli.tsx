#!/usr/bin/env node
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import React from 'react'
import { render } from 'ink'
import { App } from './ui/App.js'
import type { PermissionMode } from './types.js'

// Load .env from project root (where audrey is installed)
try {
  const dir = dirname(fileURLToPath(import.meta.url))
  const envPath = resolve(dir, '..', '.env')
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch {
  // .env is optional
}

const args = process.argv.slice(2)
let permissionMode: PermissionMode = 'ask'
if (args.includes('--auto')) permissionMode = 'auto'
if (args.includes('--deny')) permissionMode = 'deny'

render(<App permissionMode={permissionMode} />)
