const deepFrozenIdentities = new WeakSet<object>();

export const hasDeepFrozenIdentity = (value: object): boolean =>
  deepFrozenIdentities.has(value);

export const markDeepFrozenIdentity = (value: object): void => {
  deepFrozenIdentities.add(value);
};
