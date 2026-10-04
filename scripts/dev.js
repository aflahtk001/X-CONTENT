const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

function logPrefix(tag, color, msg) {
  const lines = msg.toString().split('\n');
  for (const line of lines) {
    if (line.trim().length > 0) {
      console.log(`${color}[${tag}]${colors.reset} ${line}`);
    }
  }
}

/**
 * Auto-detects the Python executable with Laya installed.
 */
function findPython() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }

  // Common virtual environment locations
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    path.join(userHome, '.venv', 'Scripts', 'python.exe'),
    path.join(userHome, '.venv', 'bin', 'python'),
    path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe'),
    path.join(__dirname, '..', '.venv', 'bin', 'python'),
    path.join(userHome, 'venv', 'Scripts', 'python.exe'),
    path.join(userHome, 'venv', 'bin', 'python'),
    'python',
    'python3',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to python in PATH
  return process.platform === 'win32' ? 'python.exe' : 'python3';
}

/**
 * Checks if Laya server is already responding on port 8000.
 */
function checkLayaPort(port = 8000) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, { timeout: 1000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log(`${colors.green}Starting Development Environment (Next.js + Laya Decision Engine)...${colors.reset}\n`);

  const processes = [];

  // 1. Check & Start Laya Server
  const isLayaRunning = await checkLayaPort(8000);
  if (isLayaRunning) {
    console.log(`${colors.magenta}[Laya Engine]${colors.reset} Already active and running on http://127.0.0.1:8000`);
  } else {
    const pythonExe = findPython();
    const layaServerPath = path.join(__dirname, '..', 'laya_server.py');

    console.log(`${colors.magenta}[Laya Engine]${colors.reset} Launching Laya server via ${pythonExe}...`);

    const layaProcess = spawn(pythonExe, [layaServerPath], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    layaProcess.stdout.on('data', (data) => logPrefix('Laya', colors.magenta, data));
    layaProcess.stderr.on('data', (data) => logPrefix('Laya', colors.dim, data));

    layaProcess.on('error', (err) => {
      console.error(`${colors.red}[Laya Error]${colors.reset} Failed to start Laya server: ${err.message}`);
    });

    layaProcess.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.log(`${colors.yellow}[Laya Engine]${colors.reset} Process exited with code ${code}`);
      }
    });

    processes.push(layaProcess);
  }

  // 2. Start Next.js Dev Server
  console.log(`${colors.cyan}[Next.js]${colors.reset} Launching Next.js app...`);
  
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  
  const nextProcess = spawn(npmCmd, ['run', 'next:dev'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: isWindows,
  });

  nextProcess.stdout?.on('data', (data) => logPrefix('Next.js', colors.cyan, data));
  nextProcess.stderr?.on('data', (data) => logPrefix('Next.js', colors.cyan, data));

  processes.push(nextProcess);

  // 3. Graceful Shutdown on Ctrl+C / SIGINT
  const cleanup = () => {
    console.log(`\n${colors.yellow}Shutting down dev processes...${colors.reset}`);
    for (const p of processes) {
      try {
        if (p && !p.killed) {
          if (isWindows && p.pid) {
            execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' });
          } else {
            p.kill('SIGTERM');
          }
        }
      } catch {}
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);
}

main().catch((err) => {
  console.error('Failed to start dev runner:', err);
  process.exit(1);
});
