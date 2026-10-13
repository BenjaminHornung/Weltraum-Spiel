import { runWorkerSmoke } from "./worker-smoke";
const button = document.querySelector<HTMLButtonElement>("#run")!;
const output = document.querySelector<HTMLPreElement>("#result")!;
button.addEventListener("click", async () => {
  button.disabled = true; output.textContent = "Running finite real worker smoke";
  try { output.textContent = JSON.stringify(await runWorkerSmoke(["c"]), null, 2); }
  catch (error) { output.textContent = String(error); }
  finally { button.disabled = false; }
});
declare global { interface Window { Phy01Lab?: { run: typeof runWorkerSmoke } } }
if (new URL(location.href).searchParams.get("testBridge") === "1") { window.Phy01Lab = { run: runWorkerSmoke }; }
