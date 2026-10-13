export function admitAdapter(adapter, requiredFeatures=[], requiredLimits={}) {
  if(!adapter) return {status:'UNSUPPORTED',reason:'ADAPTER_UNAVAILABLE'};
  for(const feature of requiredFeatures) if(!adapter.features.has(feature)) return {status:'UNSUPPORTED',reason:`FEATURE_UNAVAILABLE:${feature}`};
  for(const [key,value] of Object.entries(requiredLimits)) {
    if(!Number.isSafeInteger(value)||value<=0||!Number.isFinite(adapter.limits[key])||adapter.limits[key]<value)
      return {status:'UNSUPPORTED',reason:`LIMIT_UNAVAILABLE:${key}`};
  }
  return {status:'PASS',reason:null};
}
