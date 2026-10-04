const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

function findPython() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }

  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    path.join(userHome, '.venv', 'Scripts', 'python.exe'),
    path.join(userHome, '.venv', 'bin', 'python'),
    path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe'),
    path.join(__dirname, '..', '.venv', 'bin', 'python'),
    'python',
    'python3',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return process.platform === 'win32' ? 'python.exe' : 'python3';
}

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
  const processes = [];

  const isLayaRunning = await checkLayaPort(8000);
  if (!isLayaRunning) {
    const pythonExe = findPython();
    const layaServerPath = path.join(__dirname, '..', 'laya_server.py');

    console.log(`[Laya Engine] Starting Laya server in background via ${pythonExe}...`);
    const layaProcess = spawn(pythonExe, [layaServerPath], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: 'inherit',
    });
    processes.push(layaProcess);
  }

  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  const nextProcess = spawn(npmCmd, ['run', 'next:start'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: isWindows,
  });
  processes.push(nextProcess);

  const cleanup = () => {
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
  console.error('Failed to start production runner:', err);
  process.exit(1);
});
