import { NodeMaterial } from 'three/webgpu';
// Only public fields touched by the r186 generic override branch, plus the three
// missing node inputs. No standard shadow material is registered by this port.
export const overrideRestoreKeys = ['maskNode', 'opacityNode', 'alphaTestNode', 'positionNode', 'colorNode', 'depthNode',
    'alphaTest', 'alphaMap', 'transparent', 'side', 'displacementMap', 'displacementScale', 'displacementBias'];
export function requireDefaultOverrideCache(material) {
    if (material.customProgramCacheKey !== NodeMaterial.prototype.customProgramCacheKey)
        throw new Error('Owned generic override requires default NodeMaterial cache identity');
}
function synchronous(result) {
    if (result !== null && (typeof result === 'object' || typeof result === 'function') && typeof Reflect.get(result, 'then') === 'function')
        throw new Error('Override callback must be synchronous');
}
function beginBinding(source, target) {
    requireDefaultOverrideCache(target);
    const snapshot = overrideRestoreKeys.map(key => ({ key, value: Reflect.get(target, key), descriptor: Object.getOwnPropertyDescriptor(target, key) }));
    let restored = false;
    const restore = () => {
        if (restored)
            return;
        restored = true;
        try {
            for (const { key, value, descriptor } of snapshot) {
                // alphaTest is a public accessor: restore through its setter as well as
                // restoring own-property shape. This does not touch its private backing field.
                if (!Reflect.set(target, key, value))
                    throw new Error(`Cannot restore override ${key}`);
                if (descriptor)
                    Object.defineProperty(target, key, descriptor);
                else
                    Reflect.deleteProperty(target, key);
            }
        }
        finally {
            target.needsUpdate = true;
        }
    };
    try {
        target.maskNode = source.maskNode;
        target.opacityNode = source.opacityNode;
        target.alphaTestNode = source.alphaTestNode;
        target.needsUpdate = true;
    }
    catch (error) {
        restore();
        throw error;
    }
    return restore;
}
/** CPU object transaction used by the public hook; does not evaluate any node. */
export function withOwnedOverrideBinding(source, target, consume) {
    if (!source.allowOverride)
        return consume();
    const restore = beginBinding(source, target);
    try {
        const result = consume();
        synchronous(result);
        return result;
    }
    finally {
        restore();
    }
}
/** Public synchronous hook, scoped to caller-owned generic overrides only. */
export function installOwnedGenericOverride(renderer, owned) {
    for (const target of owned)
        requireDefaultOverrideCache(target);
    const previous = renderer.getRenderObjectFunction();
    const delegate = previous ?? renderer.renderObject;
    const stats = { bindings: 0, restores: 0, failed: false };
    let active = false, released = false;
    const hook = function (...args) {
        if (released || stats.failed)
            throw new Error('Override lease unavailable; remount renderer');
        if (active) {
            stats.failed = true;
            throw new Error('Nested generic override render is unsupported');
        }
        active = true;
        const [object, renderScene] = args;
        const before = object.onBeforeRender, after = object.onAfterRender;
        let restore = null;
        const finish = () => { const release = restore; restore = null; if (release) {
            release();
            stats.restores++;
        } };
        const beforeHook = function (...event) {
            synchronous(before.apply(this, event));
            finish();
            // The existing callback can update source nodes or the override target.
            const target = renderScene.overrideMaterial, source = event[4];
            if (target instanceof NodeMaterial && owned.has(target) && source instanceof NodeMaterial && source.allowOverride) {
                restore = beginBinding(source, target);
                stats.bindings++;
            }
        };
        const afterHook = function (...event) { finish(); synchronous(after.apply(this, event)); };
        object.onBeforeRender = beforeHook;
        object.onAfterRender = afterHook;
        try {
            synchronous(delegate.apply(renderer, args));
        }
        catch (error) {
            stats.failed = true;
            throw error;
        }
        finally {
            try {
                finish();
            }
            finally {
                // A later owner is never overwritten. Changed callback ownership makes
                // this renderer incarnation unusable until the actual owner remounts it.
                if (object.onBeforeRender === beforeHook)
                    object.onBeforeRender = before;
                else
                    stats.failed = true;
                if (object.onAfterRender === afterHook)
                    object.onAfterRender = after;
                else
                    stats.failed = true;
                active = false;
            }
        }
    };
    renderer.setRenderObjectFunction(hook);
    return { stats, release() {
            if (active)
                throw new Error('Cannot release an active override lease');
            if (released)
                return false;
            released = true;
            if (renderer.getRenderObjectFunction() !== hook)
                return false;
            renderer.setRenderObjectFunction(previous);
            return true;
        } };
}
