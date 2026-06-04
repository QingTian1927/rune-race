/**
 * Monorepo dev launcher. Forwards `--host` only to Vite apps (web, admin),
 * not to tsc -w or tsx watch.
 */
import { spawn } from 'node:child_process'

const host = process.argv.includes('--host')
const isWin = process.platform === 'win32'
const pnpm = 'pnpm'

function runPnpm(args) {
  return spawn(pnpm, args, {
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  })
}

const libArgs = [
  '-r',
  '--parallel',
  '--filter',
  '@rune-race/shared',
  '--filter',
  '@rune-race/game-engine',
  '--filter',
  '@rune-race/server',
  'dev',
]

const appArgs = [
  '-r',
  '--parallel',
  '--filter',
  '@rune-race/web',
  '--filter',
  '@rune-race/admin',
  'dev',
]
if (host) {
  appArgs.push('--host')
}

const libs = runPnpm(libArgs)
const apps = runPnpm(appArgs)

let exitCode = 0

function onExit(code, label) {
  if (code !== 0 && code !== null) {
    console.error(`[dev] ${label} exited with code ${code}`)
    exitCode = code
  }
}

libs.on('exit', (code) => onExit(code, 'libs'))
apps.on('exit', (code) => onExit(code, 'apps'))

function shutdown() {
  libs.kill('SIGTERM')
  apps.kill('SIGTERM')
}

process.on('SIGINT', () => {
  shutdown()
  process.exit(exitCode || 0)
})
process.on('SIGTERM', () => {
  shutdown()
  process.exit(exitCode || 0)
})

Promise.all([
  new Promise((resolve) => libs.on('exit', resolve)),
  new Promise((resolve) => apps.on('exit', resolve)),
]).then(() => {
  process.exit(exitCode)
})
