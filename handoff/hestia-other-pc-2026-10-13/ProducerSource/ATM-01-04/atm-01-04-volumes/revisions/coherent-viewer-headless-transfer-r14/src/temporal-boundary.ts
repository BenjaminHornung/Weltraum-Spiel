import {PORT_IDS,validateBorrowedPort,type BorrowedPortRequest,type PortId} from './borrowed-port';
import {validateFrame,type AtmosphereFrame} from './optics';
import type {FrozenSourceRef,WeatherAdmission} from '../upstream/atm-r04/contracts.proposed.d.ts';
export type OwnerPortInputs=Readonly<Partial<Record<PortId,Omit<BorrowedPortRequest,'port'|'sourceFrame'|'weather'>>>>;
/** Prepare existing metadata contracts, never manufacture a presented frame or adopt image handles. */
export function prepareTemporalRequests(frame:AtmosphereFrame,frozenWeather:FrozenSourceRef,owners:OwnerPortInputs={}){
 const sourceFrame=validateFrame(frame);
 const weather:WeatherAdmission=sourceFrame.status==='Known'?{status:'Known',frozenResult:frozenWeather,authoredMask:null}:{status:'NoAtmosphere',frozenResult:frozenWeather};
 const results=PORT_IDS.map(port=>validateBorrowedPort({...owners[port],port,sourceFrame,weather}));
 return {results,completeActualBundles:0,temporalReady:false as const,pipelineOptions:'BOTH_OPEN' as const,resourceDisposal:'PRODUCER_ONLY' as const};
}

