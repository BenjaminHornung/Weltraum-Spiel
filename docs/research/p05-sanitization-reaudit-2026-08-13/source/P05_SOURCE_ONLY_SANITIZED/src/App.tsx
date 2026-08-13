import { useMemo, useState } from "react";

const STEPS = [
  { id: "instruction", label: "Anweisung", short: "Prompt" },
  { id: "plan", label: "Tool-Plan", short: "Plan" },
  { id: "preview", label: "Dry-run", short: "Preview" },
  { id: "issues", label: "Validator", short: "Issues" },
  { id: "correction", label: "Korrektur", short: "Autofix" },
  { id: "diff", label: "Diff", short: "Review" },
  { id: "approval", label: "Owner Approval", short: "Gate" },
  { id: "commit", label: "Commit", short: "Write" },
  { id: "undo", label: "Undo", short: "Restore" },
] as const;

const FIXTURE_INSTRUCTION =
  "Erstelle für die Mission „Bergung bei Vespera“ nach dem Wrack-Scan eine echte Wahl: Pilotin retten oder Fracht sichern. Beide Pfade sollen die Mission sauber abschließen.";

const PLAN_CALLS = [
  { order: "01", tool: "missionGraph.read", scope: "mission:rescue_at_vespera@v42", permission: "READ" },
  { order: "02", tool: "missionGraph.insertChoice", scope: "after:scan_wreck", permission: "PROPOSE" },
  { order: "03", tool: "missionGraph.insertBranches", scope: "rescue_pilot | salvage_cargo", permission: "PROPOSE" },
  { order: "04", tool: "contract.validate", scope: "mission-graph/v3", permission: "VALIDATE" },
] as const;

const BASE_EVENTS = [
  { stage: 0, time: "14:32:00.000", actor: "fixture-loader", action: "fixture.bound", detail: "P05/MISSION-GRAPH-01 · base v42" },
  { stage: 1, time: "14:32:00.120", actor: "owner.mock", action: "instruction.received", detail: "input sha256:4bd7…e31a" },
  { stage: 1, time: "14:32:00.240", actor: "copilot.fixture", action: "plan.generated", detail: "plan sha256:0f81…9c22" },
  { stage: 2, time: "14:32:00.410", actor: "transaction-engine", action: "dry_run.completed", detail: "ephemeral candidate v43-dry" },
  { stage: 3, time: "14:32:00.590", actor: "validator/v3", action: "validation.failed", detail: "1 blocking · 1 warning" },
  { stage: 4, time: "14:32:00.760", actor: "copilot.fixture", action: "autofix.proposed", detail: "patch sha256:73ac…108e" },
  { stage: 5, time: "14:32:00.890", actor: "transaction-engine", action: "diff.materialized", detail: "+18 · −0 · candidate v43-dry.2" },
  { stage: 7, time: "14:32:01.120", actor: "owner.mock", action: "approval.granted", detail: "approval mock-apr-7A12" },
  { stage: 8, time: "14:32:01.360", actor: "transaction-engine", action: "commit.applied", detail: "mock commit 7d2c9a1 · authority v43" },
] as const;

const PERMISSIONS = [
  { label: "Workspace lesen", actor: "Copilot", level: "READ", status: "allow" },
  { label: "Änderung entwerfen", actor: "Copilot", level: "PROPOSE", status: "allow" },
  { label: "Verträge prüfen", actor: "Validator", level: "VALIDATE", status: "allow" },
  { label: "Authority schreiben", actor: "Owner", level: "COMMIT", status: "gate" },
  { label: "Commit umkehren", actor: "Owner", level: "UNDO", status: "gate" },
] as const;

function Mark({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "lime" | "cyan" | "amber" | "red" }) {
  return <span className={`mark mark-${tone}`}>{children}</span>;
}

function SectionHeading({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <header className="section-heading">
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      <p>{body}</p>
    </header>
  );
}

function Arrow() {
  return <span className="graph-arrow" aria-hidden="true">→</span>;
}

export default function Home() {
  const [stage, setStage] = useState(0);
  const [instruction, setInstruction] = useState(FIXTURE_INSTRUCTION);
  const [ownerAck, setOwnerAck] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [undone, setUndone] = useState(false);

  const events = useMemo(() => {
    const visible = BASE_EVENTS.filter((event) => event.stage <= stage);
    if (!undone) return visible;
    return [...visible, { stage: 8, time: "14:32:01.620", actor: "transaction-engine", action: "undo.applied", detail: "mock undo 91ba0dd · authority v42" }];
  }, [stage, undone]);

  const reset = () => {
    setStage(0);
    setInstruction(FIXTURE_INSTRUCTION);
    setOwnerAck(false);
    setCommitted(false);
    setUndone(false);
  };

  const advance = () => setStage((current) => Math.min(current + 1, 8));

  const action = (() => {
    if (stage === 0) return { label: "Tool-Plan erzeugen", note: "Keine Daten werden geschrieben", onClick: advance, disabled: instruction.trim().length === 0 };
    if (stage === 1) return { label: "Dry-run ausführen", note: "Nur flüchtige Candidate-Version", onClick: advance, disabled: false };
    if (stage === 2) return { label: "Validator starten", note: "Golden Contract mission-graph/v3", onClick: advance, disabled: false };
    if (stage === 3) return { label: "Korrektur vorschlagen", note: "Copilot bleibt im PROPOSE-Level", onClick: advance, disabled: false };
    if (stage === 4) return { label: "Korrektur anwenden", note: "Erneuter Dry-run, kein Commit", onClick: advance, disabled: false };
    if (stage === 5) return { label: "Zum Owner-Gate", note: "Diff wird unverändert eingefroren", onClick: advance, disabled: false };
    if (stage === 6) return { label: "Freigabe erteilen", note: "Simulierte Owner-Identität", onClick: advance, disabled: !ownerAck };
    if (stage === 7) return { label: "Mock-Commit schreiben", note: "Schreibt nur in den lokalen Demo-Zustand", onClick: () => { setCommitted(true); setStage(8); }, disabled: false };
    if (undone) return { label: "Fixture neu starten", note: "Deterministischer Reset auf v42", onClick: reset, disabled: false };
    return { label: "Commit rückgängig machen", note: "Inverse Operation auf Authority v42", onClick: () => setUndone(true), disabled: !committed };
  })();

  const renderStage = () => {
    if (stage === 0) {
      return (
        <>
          <SectionHeading kicker="01 · Nutzeranweisung" title="Was soll sich ändern?" body="Die Anweisung startet eine isolierte Transaktion. Der Copilot darf daraus nur einen Vorschlag erzeugen." />
          <div className="composer-card">
            <div className="composer-meta"><span>OWNER INPUT</span><Mark tone="amber">DETERMINISTISCHE FIXTURE</Mark></div>
            <label className="sr-only" htmlFor="instruction">Nutzeranweisung</label>
            <textarea id="instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={7} spellCheck={false} />
            <div className="composer-footer"><span>{instruction.length} Zeichen</span><span>fixture://P05/MISSION-GRAPH-01</span></div>
          </div>
          <div className="callout callout-info"><span className="callout-icon">i</span><div><strong>Simulationsgrenze</strong><p>Die Eingabe ist editierbar, die folgenden Antworten stammen jedoch immer aus derselben lokalen Fixture. Es findet kein Modellaufruf statt.</p></div></div>
        </>
      );
    }

    if (stage === 1) {
      return (
        <>
          <SectionHeading kicker="02 · Strukturierter Tool-Plan" title="Vier Schritte, noch kein Write" body="Der Plan benennt Scope, Reihenfolge und benötigte Berechtigungen, bevor ein Werkzeug simuliert wird." />
          <div className="plan-list" role="list" aria-label="Tool-Plan">
            {PLAN_CALLS.map((call) => (
              <article className="plan-row" role="listitem" key={call.order}>
                <span className="plan-order">{call.order}</span>
                <div className="plan-copy"><strong>{call.tool}</strong><code>{call.scope}</code></div>
                <Mark tone={call.permission === "READ" ? "cyan" : call.permission === "VALIDATE" ? "amber" : "lime"}>{call.permission}</Mark>
              </article>
            ))}
          </div>
          <div className="contract-strip"><div><span>Base version</span><strong>v42</strong></div><div><span>Plan hash</span><strong>0f81…9c22</strong></div><div><span>Mutation budget</span><strong>4 nodes / 4 edges</strong></div></div>
        </>
      );
    }

    if (stage === 2) {
      return (
        <>
          <SectionHeading kicker="03 · Dry-run Preview" title="Candidate v43-dry" body="Der Plan wurde gegen einen flüchtigen Snapshot ausgeführt. Die Authority bleibt unverändert auf v42." />
          <div className="preview-grid">
            <div className="graph-card">
              <div className="card-toolbar"><span>MISSION GRAPH · CANDIDATE</span><Mark tone="cyan">EPHEMERAL</Mark></div>
              <div className="graph-flow" aria-label="Vorschau des Missionsgraphen">
                <div className="graph-node node-base"><span>TRIGGER</span><strong>scan_wreck</strong></div><Arrow />
                <div className="graph-node node-choice"><span>CHOICE</span><strong>choose_priority</strong></div><Arrow />
                <div className="graph-branches"><div className="graph-node node-new"><span>BRANCH A</span><strong>rescue_pilot</strong></div><div className="graph-node node-new"><span>BRANCH B</span><strong>salvage_cargo</strong></div></div>
              </div>
            </div>
            <aside className="delta-card"><p className="kicker">Dry-run Delta</p><dl><div><dt>Nodes</dt><dd>+4</dd></div><div><dt>Edges</dt><dd>+4</dd></div><div><dt>Persistiert</dt><dd className="zero">0</dd></div></dl><p className="mono-note">authorityHash bleibt<br />sha256:b798…2fa0</p></aside>
          </div>
          <div className="callout callout-warn"><span className="callout-icon">!</span><div><strong>Preview ist nicht validiert</strong><p>Die sichtbare Form beweist noch keine Contract-Korrektheit.</p></div></div>
        </>
      );
    }

    if (stage === 3) {
      return (
        <>
          <SectionHeading kicker="04 · Validator Issues" title="Commit blockiert" body="Der Validator prüft den Candidate gegen mission-graph/v3 und liefert maschinenlesbare Evidence." />
          <div className="issue-summary"><div><span className="summary-number danger">1</span><span>BLOCKING</span></div><div><span className="summary-number warning">1</span><span>WARNING</span></div><div><span className="summary-number success">17</span><span>PASSED</span></div></div>
          <div className="issues-list">
            <article className="issue-card issue-blocking"><div className="issue-head"><Mark tone="red">MG-VAL-017 · BLOCKING</Mark><span>terminal-path</span></div><h2>Beide Wahlpfade enden ohne Abschlussknoten.</h2><p>Jeder erreichbare Missionspfad muss genau einen terminalen <code>mission.complete</code>-Knoten erreichen.</p><pre>rescue_pilot.out = []{`\n`}salvage_cargo.out = []</pre></article>
            <article className="issue-card issue-warning"><div className="issue-head"><Mark tone="amber">NAR-VAL-004 · WARNING</Mark><span>outcome-copy</span></div><h2>Die Pfade besitzen keinen expliziten Ausgangstext.</h2><p>Der Abschluss wäre technisch möglich, aber für den Spieler nicht eindeutig erklärt.</p></article>
          </div>
        </>
      );
    }

    if (stage === 4) {
      return (
        <>
          <SectionHeading kicker="05 · Automatische Korrektur" title="Minimaler, intent-erhaltender Patch" body="Der Copilot schlägt eine Korrektur vor, darf sie aber nur in einem neuen Dry-run anwenden." />
          <article className="autofix-card">
            <div className="autofix-top"><div><Mark tone="lime">AUTOFIX · PROPOSE ONLY</Mark><h2>Gemeinsamen Auflösungsknoten ergänzen</h2></div><div className="risk-badge"><span>Scope-Risiko</span><strong>NIEDRIG</strong></div></div>
            <ol className="fix-list">
              <li><span>01</span><div><strong><code>resolve_outcome</code> einfügen</strong><p>Branch-spezifische Copy-Keys werden am gemeinsamen Knoten aufgelöst.</p></div></li>
              <li><span>02</span><div><strong>Beide Pfade verbinden</strong><p><code>rescue_pilot</code> und <code>salvage_cargo</code> zeigen auf denselben Resolver.</p></div></li>
              <li><span>03</span><div><strong>Terminale Kante ergänzen</strong><p><code>resolve_outcome → mission.complete</code> erfüllt den Contract.</p></div></li>
            </ol>
            <div className="autofix-foot"><span>Erwartet: 0 blocking · 0 warning</span><span>Patch hash 73ac…108e</span></div>
          </article>
        </>
      );
    }

    if (stage === 5) {
      return (
        <>
          <SectionHeading kicker="06 · Diff" title="Candidate v43-dry.2" body="Nur dieser eingefrorene Diff kann freigegeben werden. Eine spätere Änderung würde das Approval ungültig machen." />
          <div className="diff-card">
            <div className="card-toolbar"><span>content/missions/rescue_at_vespera.graph.json</span><div className="diff-stats"><span>+18</span><span>−0</span></div></div>
            <div className="diff-body" role="region" aria-label="Änderungsdiff">
              <div className="diff-line context"><span>41</span><span>41</span><code>{`  "nodes": [`}</code></div>
              <div className="diff-line add"><span></span><span>42</span><code>{`+   { "id": "choose_priority", "type": "choice" },`}</code></div>
              <div className="diff-line add"><span></span><span>43</span><code>{`+   { "id": "rescue_pilot", "type": "objective" },`}</code></div>
              <div className="diff-line add"><span></span><span>44</span><code>{`+   { "id": "salvage_cargo", "type": "objective" },`}</code></div>
              <div className="diff-line add"><span></span><span>45</span><code>{`+   { "id": "resolve_outcome", "type": "resolver",`}</code></div>
              <div className="diff-line add"><span></span><span>46</span><code>{`+     "copyBySource": {`}</code></div>
              <div className="diff-line add"><span></span><span>47</span><code>{`+       "rescue_pilot": "mission.vespera.pilot_saved",`}</code></div>
              <div className="diff-line add"><span></span><span>48</span><code>{`+       "salvage_cargo": "mission.vespera.cargo_secured"`}</code></div>
              <div className="diff-line add"><span></span><span>49</span><code>{`+     }`}</code></div>
              <div className="diff-line add"><span></span><span>50</span><code>{`+   }`}</code></div>
              <div className="diff-line context"><span>42</span><span>51</span><code>{`  ],`}</code></div>
              <div className="diff-line add"><span></span><span>61</span><code>{`+ { "from": "rescue_pilot", "to": "resolve_outcome" },`}</code></div>
              <div className="diff-line add"><span></span><span>62</span><code>{`+ { "from": "salvage_cargo", "to": "resolve_outcome" },`}</code></div>
              <div className="diff-line add"><span></span><span>63</span><code>{`+ { "from": "resolve_outcome", "to": "mission.complete" }`}</code></div>
            </div>
          </div>
          <div className="validation-pass"><span>✓</span><div><strong>Re-validation passed</strong><p>19/19 Checks · validator/v3 · result sha256:be18…27cc</p></div></div>
        </>
      );
    }

    if (stage === 6) {
      return (
        <>
          <SectionHeading kicker="07 · Owner Approval" title="Write-Gate wartet auf den Owner" body="Der Copilot kann dieses Gate nicht selbst erfüllen. Die Freigabe bindet Base-Version, Plan und Diff kryptografisch im Contract." />
          <div className="approval-layout">
            <article className="approval-card"><div className="approval-seal">OWNER<br />GATE</div><div><p className="kicker">Freigabeumfang</p><h2>Genau Candidate v43-dry.2</h2><dl className="approval-facts"><div><dt>Base</dt><dd>v42 · b798…2fa0</dd></div><div><dt>Plan</dt><dd>0f81…9c22</dd></div><div><dt>Diff</dt><dd>be18…27cc</dd></div><div><dt>Validator</dt><dd>19/19 passed</dd></div></dl></div></article>
            <label className={`approval-check ${ownerAck ? "checked" : ""}`}><input type="checkbox" checked={ownerAck} onChange={(event) => setOwnerAck(event.target.checked)} /><span className="check-box" aria-hidden="true">{ownerAck ? "✓" : ""}</span><span><strong>Diff und Validator-Evidence geprüft</strong><small>Ich erteile die simulierte Owner-Freigabe für genau diesen eingefrorenen Candidate.</small></span></label>
          </div>
          <div className="callout callout-warn"><span className="callout-icon">!</span><div><strong>Mock-Identität</strong><p>Dieses UX-Artefakt enthält keine Authentifizierung. <code>owner.mock</code> ist ausschließlich Fixture-Provenienz.</p></div></div>
        </>
      );
    }

    if (stage === 7) {
      return (
        <>
          <SectionHeading kicker="08 · Commit" title="Transaktion ist schreibbereit" body="Alle Preconditions sind erfüllt. Erst der folgende Owner-Commit verändert die simulierte Authority." />
          <div className="preconditions-card">
            <div className="precondition-head"><span className="pulse-dot"></span><strong>PRECONDITIONS LOCKED</strong><Mark tone="lime">READY</Mark></div>
            <div className="precondition-grid"><div><span>Base unverändert</span><strong>v42 = v42</strong><i>✓</i></div><div><span>Plan stabil</span><strong>0f81…9c22</strong><i>✓</i></div><div><span>Blocking Issues</span><strong>0</strong><i>✓</i></div><div><span>Approval Token</span><strong>mock-apr-7A12</strong><i>✓</i></div></div>
            <div className="commit-preview"><span>v42</span><div className="commit-track"><i></i><b></b></div><span>v43</span></div>
          </div>
          <div className="callout callout-info"><span className="callout-icon">i</span><div><strong>Isolierter Mock-Write</strong><p>Der Commit verändert ausschließlich React-State in dieser Demo. Kein Repository, keine Datei und kein Produkt werden geschrieben.</p></div></div>
        </>
      );
    }

    return (
      <>
        <SectionHeading kicker="09 · Undo" title={undone ? "Authority auf v42 wiederhergestellt" : "Mock-Commit 7d2c9a1 erstellt"} body={undone ? "Die inverse Operation wurde als eigener Provenienzschritt protokolliert. Der ursprüngliche Commit bleibt nachvollziehbar." : "Der Commit ist atomar abgeschlossen und besitzt eine explizite inverse Operation."} />
        <div className={`receipt-card ${undone ? "receipt-undone" : ""}`}>
          <div className="receipt-icon">{undone ? "↶" : "✓"}</div>
          <div className="receipt-main"><Mark tone={undone ? "cyan" : "lime"}>{undone ? "UNDO APPLIED" : "COMMIT APPLIED"}</Mark><h2>{undone ? "mock undo 91ba0dd" : "mock commit 7d2c9a1"}</h2><p>{undone ? "Inverse von 7d2c9a1 · authorityHash stimmt wieder mit v42 überein." : "Candidate v43-dry.2 wurde als Authority v43 übernommen."}</p></div>
          <dl className="receipt-facts"><div><dt>Authority</dt><dd>{undone ? "v42" : "v43"}</dd></div><div><dt>Hash</dt><dd>{undone ? "b798…2fa0" : "45c1…8d72"}</dd></div><div><dt>Reversibel</dt><dd>{undone ? "erledigt" : "ja"}</dd></div></dl>
        </div>
        {!undone && <div className="undo-preview"><div><span>Inverse Operation</span><strong>restoreSnapshot(base:v42)</strong></div><div><span>Erwarteter Result-Hash</span><strong>sha256:b798…2fa0</strong></div></div>}
        {undone && <div className="validation-pass"><span>✓</span><div><strong>Round-trip verified</strong><p>baseline hash before = baseline hash after undo</p></div></div>}
      </>
    );
  };

  return (
    <main className="lab-shell">
      <a className="skip-link" href="#workspace">Zum Arbeitsbereich springen</a>
      <div className="mock-ribbon"><span>MOCK FIXTURE</span><span>KEINE EXTERNE KI</span><span>KEIN PRODUKT-WRITE</span></div>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">H</span><div><strong>HELIOS</strong><small>AI TRANSACTION LAB</small></div></div>
        <div className="topbar-center"><span className="status-dot"></span><span>ISOLIERTER PROTOTYP</span><code>TX-MG-2048</code></div>
        <button className="ghost-button" type="button" onClick={reset}>Ablauf zurücksetzen</button>
      </header>
      <div className="app-grid">
        <nav className="steps-panel" aria-label="Transaktionsschritte">
          <div className="panel-label"><span>TRANSACTION</span><strong>{undone ? "COMPLETE" : `${String(stage + 1).padStart(2, "0")}/09`}</strong></div>
          <ol>
            {STEPS.map((step, index) => {
              const isComplete = index < stage || (undone && index === 8);
              const isActive = index === stage && !undone;
              return <li key={step.id} className={`${isActive ? "active" : ""} ${isComplete ? "complete" : ""}`} aria-current={isActive ? "step" : undefined}><span className="step-index">{isComplete ? "✓" : String(index + 1).padStart(2, "0")}</span><span className="step-copy"><strong>{step.label}</strong><small>{step.short}</small></span><span className="step-line" aria-hidden="true"></span></li>;
            })}
          </ol>
          <div className="authority-card"><span>AUTHORITATIVE STATE</span><strong>{stage === 8 && !undone ? "MISSION GRAPH v43" : "MISSION GRAPH v42"}</strong><small>CPU-Datenmodell · simuliert</small></div>
        </nav>
        <section className="workspace-panel" id="workspace" aria-live="polite">
          <div className="workspace-content">{renderStage()}</div>
          <footer className="action-bar"><div><span className="action-state">{undone ? "TRANSACTION CLOSED" : `STEP ${String(stage + 1).padStart(2, "0")} OF 09`}</span><small>{action.note}</small></div><button className="primary-button" type="button" onClick={action.onClick} disabled={action.disabled}>{action.label}<span aria-hidden="true">{undone ? "↻" : stage === 8 ? "↶" : "→"}</span></button></footer>
        </section>
        <aside className="inspector-panel">
          <section className="inspector-section"><div className="panel-label"><span>PERMISSIONS</span><strong>LEAST PRIVILEGE</strong></div><div className="permission-list">{PERMISSIONS.map((permission, index) => { const unlocked = permission.status === "allow" || (index === 3 && stage >= 7) || (index === 4 && stage >= 8); return <div className="permission-row" key={permission.level}><span className={`permission-icon ${unlocked ? "unlocked" : "locked"}`}>{unlocked ? "✓" : "◇"}</span><div><strong>{permission.label}</strong><small>{permission.actor}</small></div><code>{permission.level}</code></div>; })}</div></section>
          <section className="inspector-section provenance-section"><div className="panel-label"><span>PROVENIENZ</span><strong>{String(events.length).padStart(2, "0")} EVENTS</strong></div><div className="event-list" aria-label="Provenienzlog">{[...events].reverse().map((event, index) => <article className="event-row" key={`${event.action}-${event.time}`}><div className="event-rail"><span></span>{index < events.length - 1 && <i></i>}</div><div className="event-copy"><div><strong>{event.action}</strong><time>{event.time}</time></div><p>{event.detail}</p><small>{event.actor}</small></div></article>)}</div></section>
          <section className="inspector-section fixture-section"><div className="panel-label"><span>FIXTURE</span><strong>LOCKED</strong></div><dl><div><dt>Schema</dt><dd>mission-graph/v3</dd></div><div><dt>Seed</dt><dd>0x05A17E</dd></div><div><dt>Clock</dt><dd>deterministic</dd></div><div><dt>Network</dt><dd>disabled</dd></div></dl></section>
        </aside>
      </div>
    </main>
  );
}
