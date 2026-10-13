import type {BorrowedPortDisposition, BorrowedPortRequest, PortId} from '../src/borrowed-port';

// Source preparations only: no validator invocation, synthetic image/header production or test runner.
export interface PreparedRegression {
  readonly id: string;
  readonly port: PortId;
  readonly given: string;
  readonly expected: readonly BorrowedPortDisposition['status'][];
  readonly original: 'revisions/temporal-port-boundary-r01/regressions.json';
  readonly execution: 'NOT_RUN';
}
export const REGRESSION_CASES = ([
  {id:'PIPELINE-01',port:'GL_VOLUME',given:'Producer disposalOwner differs or common pipeline attachment is unavailable',expected:['Unsupported','Pending']},
  {id:'FRAME-01',port:'FRAME',given:'Actual sourceFrame tick/digest/reference invalid or weather status mismatched',expected:['Unsupported']},
  {id:'WEATHER-01',port:'WEATHER',given:'Pending dependency or Unsupported/UnknownCoverage reason; no Earth/vacuum coercion',expected:['Pending','Unsupported']},
  {id:'WEATHER-02',port:'FRAME',given:'Missing orbital weather read or explicitly unsupported orbit query; cloned ground query is not orbital proof',expected:['Pending','Unsupported']},
  {id:'OPTICS-01',port:'OPTICS',given:'Missing segment, invalid T/L or explicit NoAtmosphere with nonempty segment',expected:['Pending','Unsupported']},
  {id:'DEPTH-01',port:'DEPTH',given:'Missing depth convention, color-coded/non-native/sampleCount mismatch or wrong clip range',expected:['Pending','Unsupported']},
  {id:'DEPTH-02',port:'DEPTH',given:'Borrowed frame/generation changes after resize/loss/disposal, or current epoch missing',expected:['Unsupported','Pending']},
  {id:'VELOCITY-01',port:'VELOCITY',given:'Velocity missing or no previous transform/deformation oracle; no fabricated zero image',expected:['Pending','Unsupported']},
  {id:'VELOCITY-02',port:'MATERIAL',given:'Leaf deforms or new topology appears but previous geometry oracle is absent',expected:['Pending','Unsupported']},
  {id:'MATERIAL-01',port:'MATERIAL',given:'Old visual parity FAIL retained; source-only validation cannot accept material parity',expected:['ValidatedSourceOnly','Pending','Unsupported']},
  {id:'LIGHT-01',port:'LIGHT_REACTIVITY',given:'Missing begin/change/end event projection, or collapsed fixture.lightning label',expected:['Pending','Unsupported']},
  {id:'LIGHT-02',port:'LIGHT_REACTIVITY',given:'Reactive mask carries lighting/shadow provenance differing from presented light',expected:['Unsupported','Pending']},
  {id:'ORIGIN-01',port:'GL_VOLUME',given:'Current/image origin or actual atlas epoch mismatches; no rebase compensation fabricated',expected:['Unsupported','Pending']},
  {id:'WATER-01',port:'WETNESS_WATER',given:'Water depth replaces opaque depth or transparent front/back strategy changes',expected:['Unsupported','Pending']},
  {id:'WATER-02',port:'WETNESS_WATER',given:'Water depth disposition or reactive coverage missing; no opaque/multilayer shortcut',expected:['Pending','Unsupported']},
  {id:'RESET-01',port:'HISTORY',given:'Logical HistoryFrame/resources counter supplied as package GPU history',expected:['Pending','Unsupported']},
  {id:'RESET-02',port:'HISTORY',given:'Stale history epoch/sourceFrame, false validity, stale atlas or absent reset-era metadata',expected:['Unsupported','Pending']},
  {id:'RAIN-01',port:'RAIN',given:'Missing current owner/depth/coverage or unsupported weather; preserve RD unknown exposure',expected:['Pending','Unsupported']},
  {id:'OUTPUT-01',port:'OUTPUT_VIEW',given:'Already tone-mapped or non-linear HDR input; missing pre-tone contribution',expected:['Unsupported','Pending']},
  {id:'NEGATIVES-01',port:'OUTPUT_VIEW',given:'No actual visual/reference acceptance from structurally valid metadata; old negative populations untouched',expected:['ValidatedSourceOnly','Pending','Unsupported']}
] as const).map(row => ({...row, original:'revisions/temporal-port-boundary-r01/regressions.json' as const, execution:'NOT_RUN' as const})) satisfies readonly PreparedRegression[];

// Compiler-only negative contracts; declarations have no runtime value or execution.
type FrameType = NonNullable<BorrowedPortRequest['sourceFrame']>;
type DrawableStatus<T extends FrameType['status']> = T;
type RequiresTrue<T extends true> = T;
type RequestKey<T extends keyof BorrowedPortRequest> = T;
// @ts-expect-error Pending is not a drawable actual AtmosphereFrame.
type InvalidDrawableStatus = DrawableStatus<'Pending'>;
// @ts-expect-error Validator never grants temporalReady=true.
type TemporalAcceptance = RequiresTrue<Extract<BorrowedPortDisposition, {status:'ValidatedSourceOnly'}>['temporalReady']>;
// @ts-expect-error Candidate has no disposal API for borrowed producer resources.
type BorrowedDisposal = RequestKey<'dispose'>;
