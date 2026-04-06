import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(__dirname, '..', '..', 'backend')

/** True if something is already accepting TCP on this port (e.g. API already running). */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' })
    socket.setTimeout(600)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => resolve(false))
  })
}

/**
 * Starts ../backend/server.js when `vite` runs, so /api proxy always has a target.
 * Set VITE_SKIP_BACKEND=1 to disable (e.g. when you run the API in another terminal).
 */
export function backendDevPlugin() {
  let child = null

  return {
    name: 'backend-dev',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.VITE_SKIP_BACKEND === '1') {
        console.log('[vite] VITE_SKIP_BACKEND=1 — not starting backend')
        return
      }

      if (await isPortInUse(5000)) {
        console.log('[vite] Backend already on port 5000 — skipping spawn')
        return
      }

      console.log('[vite] Starting backend (port 5000)…')
      child = spawn(process.execPath, ['server.js'], {
        cwd: backendDir,
        stdio: 'inherit',
        env: { ...process.env },
      })

      child.on('exit', (code, signal) => {
        if (signal === 'SIGTERM') return
        if (code !== 0 && code !== null) {
          console.warn(`[vite] Backend process exited with code ${code}`)
        }
      })

      const kill = () => {
        if (child && !child.killed) {
          child.kill('SIGTERM')
          child = null
        }
      }

      server.httpServer?.on('close', kill)
      process.once('SIGINT', kill)
      process.once('SIGTERM', kill)
    },
  }
}
