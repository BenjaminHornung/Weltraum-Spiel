const capacityTolerance = (value: number, capacity: number): number =>
  Number.isFinite(value) && Number.isFinite(capacity)
    ? Number.EPSILON * Math.max(Math.abs(value), Math.abs(capacity)) * 16
    : 0;

export const fitsWithinCapacity = (value: number, capacity: number): boolean =>
  Number.isFinite(value) && (value <= capacity || value - capacity <= capacityTolerance(value, capacity));

export const clampNearCapacity = (value: number, capacity: number): number =>
  value > capacity && fitsWithinCapacity(value, capacity) ? capacity : value;
