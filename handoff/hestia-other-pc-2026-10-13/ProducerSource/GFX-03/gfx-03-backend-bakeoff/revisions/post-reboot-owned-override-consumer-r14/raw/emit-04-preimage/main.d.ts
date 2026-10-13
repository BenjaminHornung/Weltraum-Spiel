import { type Variant } from './port.ts';
export declare function dispose(): Promise<void>;
declare function mountNow(next: Variant, opts?: {
    requiredFeatures?: GPUFeatureName[];
    requiredLimits?: Record<string, number>;
    forceNoAdapter?: boolean;
}): Promise<Record<string, unknown>>;
export declare function mount(next: Variant, opts?: Parameters<typeof mountNow>[1]): Promise<Record<string, unknown>>;
export {};
