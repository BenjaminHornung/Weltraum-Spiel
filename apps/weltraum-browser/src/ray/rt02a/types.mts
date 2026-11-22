export type Vec3 = [number, number, number];
export type Matrix3 = [number, number, number, number, number, number, number, number, number];
export interface Binding {
  domain: string; world: string; session: string; epoch: string;
  owner: string; sourceRevision: number; sourceGeneration: number; sourceDigest: string;
  frame: string; originEpoch: number; transformGeneration: number;
  materialDigest: string; algorithm: string;
}
export interface Volume {
  id: string; provenance: 'ANALYTICAL' | 'RD_SYNTHETIC' | 'PRODUCT_EXPORT';
  binding: Binding;
  size: Vec3; cellMeters: number; origin: Vec3;
  rotation: Matrix3; translation: Vec3;
  authorityLeafEdge: number; rayPageEdge: number;
  coverage: 'complete' | 'partial';
  exteriorCoverage: 'KnownEmpty' | 'Unknown';
  /** x-fastest, then y, then z. -1 Unknown, 0 KnownEmpty, positive MaterialId. */
  cells: number[];
  /** Stable source cell identities; transferred occupied cells keep their identity. */
  cellIds: string[];
  materials: { id: number; role: string; source: string }[];
}
export interface Ray { id: string; origin: Vec3; direction: Vec3; maxDistance: number; maxSteps: number }
export interface RayResult {
  kind: 'Hit' | 'Miss' | 'Unknown' | 'BudgetExceeded';
  distance: number; normal: Vec3; cell: Vec3 | null; materialId: number | null;
  materialSource: string | null; owner: string | null; cellId: string | null;
  sourceRevision: number | null; sourceGeneration: number | null;
  transformGeneration: number | null; originEpoch: number | null;
}
