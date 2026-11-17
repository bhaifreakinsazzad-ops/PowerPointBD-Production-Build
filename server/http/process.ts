import { spawn } from 'node:child_process';

export class ProcessFailure extends Error {
  constructor(public readonly code: string) { super(code); }
}

/** Bounded subprocess protocol. Never expose child output in public errors. */
export function runBoundedProcess(
  command: string, args: string[],
  options: { timeoutMs?: number; maxOutputBytes?: number; signal?: AbortSignal } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) { reject(new ProcessFailure('JOB_CANCELLED')); return; }
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      detached: process.platform !== 'win32' });
    const chunks: Buffer[] = [];
    let outputBytes = 0;
    let failure: Error | undefined;
    const stop = (code: string) => {
      if (failure) return;
      failure = new ProcessFailure(code);
      if (process.platform === 'win32' && child.pid && child.exitCode === null) {
        // Office/renderer launchers spawn children. Killing only the launcher
        // leaves orphaned conversions holding private files after cancellation.
        const killer = spawn(`${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\taskkill.exe`,
          ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        killer.on('error', () => child.kill('SIGKILL'));
        killer.on('close', (code) => { if (code !== 0 && child.exitCode === null) child.kill('SIGKILL'); });
      } else if (child.pid && process.platform !== 'win32') {
        try { process.kill(-child.pid,'SIGKILL'); } catch { child.kill('SIGKILL'); }
      } else child.kill('SIGKILL');
    };
    const abort = () => stop('JOB_CANCELLED');
    const timer = setTimeout(() => stop('PROCESS_TIMEOUT'), options.timeoutMs ?? 60_000);
    options.signal?.addEventListener('abort', abort, { once: true });
    const collect = (data: Buffer, stdout: boolean) => {
      outputBytes += data.length;
      if (outputBytes > (options.maxOutputBytes ?? 1_048_576)) stop('PROCESS_OUTPUT_LIMIT');
      else if (stdout) chunks.push(data);
    };
    child.stdout.on('data', (data: Buffer) => collect(data, true));
    child.stderr.on('data', (data: Buffer) => collect(data, false));
    child.on('error', () => { failure ??= new ProcessFailure('PROCESS_START_FAILED'); });
    // Wait for close, including killed children, before callers remove temp files.
    child.on('close', (code) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      if (failure) { reject(failure); return; }
      if (code !== 0) { reject(new ProcessFailure('PROCESS_FAILED')); return; }
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

export async function runJsonProcess(command: string, args: string[],
  options: { timeoutMs?: number; maxOutputBytes?: number; signal?: AbortSignal } = {}): Promise<unknown> {
  const output = await runBoundedProcess(command,args,options);
  try { return JSON.parse(output); }
  catch { throw new ProcessFailure('PROCESS_INVALID_JSON'); }
}
