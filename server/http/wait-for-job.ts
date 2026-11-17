/** Polls the HTTP contract; callers must run a detached worker separately. */
export async function waitForJob(
  call: (path: string) => Promise<Response>, projectId: string, jobId: string, timeoutMs = 180_000,
): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const response = await call(`/projects/${projectId}/status`);
    if (!response.ok) throw new Error('Production status request failed.');
    const body = await response.json() as { data: { job: { id: string; status: string } | null } };
    if (body.data.job?.id !== jobId) throw new Error('Production status returned an unexpected job.');
    if (body.data.job.status === 'completed') return;
    if (body.data.job.status === 'quarantined') throw new Error('Production was quarantined.');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Production did not finish within the test deadline. Start a detached worker and check its storage credentials.');
}
