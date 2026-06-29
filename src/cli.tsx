#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { App } from './ui/App.js'
import type { PermissionMode } from './types.js'

const args = process.argv.slice(2)
let permissionMode: PermissionMode = 'ask'
if (args.includes('--auto')) permissionMode = 'auto'
if (args.includes('--deny')) permissionMode = 'deny'

render(<App permissionMode={permissionMode} />)
