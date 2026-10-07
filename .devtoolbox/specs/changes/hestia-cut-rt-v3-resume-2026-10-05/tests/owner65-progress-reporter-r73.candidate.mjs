/** Diagnostic only: original test/reporters/deadlines remain authoritative. */
export default class Owner65ProgressReporter {
  started = performance.now();
  bytes = 0;
  disabled = false;
  record(event, entity, hook) {
    if (this.disabled) return;
    try {
      const name = typeof entity?.name === "string" ? entity.name.slice(0, 240) : "module";
      const state = event === "case-result" ? entity.result().state : undefined;
      const duration = event === "case-result" ? entity.diagnostic()?.duration : undefined;
      const durationMs = Number.isFinite(duration) && duration >= 0 ? duration : undefined;
      const line = `OWNER65_PROGRESS ${JSON.stringify({event, name, hook, state, durationMs,
        elapsedMs: performance.now() - this.started})}\n`;
      const bytes = Buffer.byteLength(line);
      if (this.bytes + bytes > 512 * 1024 - 128) {
        this.disabled = true;
        process.stdout.write("OWNER65_PROGRESS_TRUNCATED diagnostic limit reached\n");
        return;
      }
      this.bytes += bytes;
      process.stdout.write(line);
    } catch { this.disabled = true; }
  }
  onTestCaseReady(value) { this.record("case-ready", value); }
  onTestCaseResult(value) { this.record("case-result", value); }
  onHookStart(value) { this.record("hook-start", value.entity, value.name); }
  onHookEnd(value) { this.record("hook-end", value.entity, value.name); }
}
