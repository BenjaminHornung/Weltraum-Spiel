# Read-only proposal after normal83

Actual normal11 subset ended17:24:15.175926UTC,126.8826s,Exit1:9PASS/1ZregionFAIL/1NOT_RUN. Xsource-region reached at−6.300003 after6ordinarytrustedTaps; Zuses16realTaps and ends8.574978 below8.725. All22taps move with correct direction;25msZcorrections still0.55–0.65m, two releasedNative reads show equalposes at later ticks. No source/Native glitch inferred; actualDOM/native delivery edge times are unknown. Actual failedcase trace reports585–623ms total25ms keyboardPressAPI roundtrip only.

Installed Playwright1.61.1 code is read-only bound in83-installed-playwright-keyboard-source-receipt.json/extract. Server Keyboard.press awaitsDown (which awaits ChromiumInput.dispatchKeyEventACK), then starts nominal delay, then sendsUp. This source ordering supplies a concrete test-protocol latency-floor explanation to investigate; total API latency is not equivalent to DOMheldduration. Separate public trusted keyboard.down/up methods are independent channelcalls. Server keypressstate is updated synchronously before awaiting each raweventACK; FIFO from one sender preservesDown thenUp requestorder when issued sequentially.

Smallest proposed gesture, no product/runtime edits:

```ts
const down = page.keyboard.down(key);
const up = new Promise<void>(resolve => setTimeout(resolve, holdMs)).then(() => page.keyboard.up(key));
try { await Promise.all([down, up]); } finally { await up; }
```

The ordinary finiteNodegesturetimer begins when Down is initiated, not when its browserACK arrives. Up is independently initiated before waitingDownACK; finally awaits the same release even ifDown rejects. There are no concurrent gestures; both promises settle before any NativeRead. No DOMdispatch, hooks, Workerwrapper, WorldAPI, NativeIPC/pose/tick/faketime/clock, speed/Reach/Source/queue/deadline or per-case budget changes. Existing caps125→63→32→25/max4percase8X16Z/releasedReads≤3/Source assertions stay. Runner-local issue/ACK timestamps can honestly show request ordering, but must not be labelled DOMedge/nativeACK authority. No positive motion guarantee; both edges may fall between legitimate native ticks.

This is a proposal ONLY. ALL30 productbytes remain f36718…; no new job/browser/sourcewrite authorized by this note. Original83 allartifacts/raw remain preserved; CPU/GPU/5174released.
