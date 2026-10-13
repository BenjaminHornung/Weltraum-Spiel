const allowedTargets = new Set([32, 128, 512]);
const emptySamples = () => ({min: 0, max: 0, avg: 0});
const isThenable = value => value && typeof value.then === 'function';

export class PhotoSession {
  get busy() { return Boolean(this._pending || this._actions); }
  constructor(driver, bindingKey) {
    if (!driver || ['reset', 'resize', 'sample', 'dispose'].some(method => typeof driver[method] !== 'function')) {
      throw new TypeError('driver must implement reset, resize, sample, and dispose');
    }
    this.driver = driver;
    this.bindingKey = bindingKey;
    this.state = 'ready';
    this.samples = emptySamples();
    this.epoch = 0;
    this.target = 0;
    this._hasSamples = false;
    this._pending = null;
    this._actions = null;
    this._terminalPromise = null;
  }

  start(target) {
    if (!allowedTargets.has(target)) throw new RangeError('target must be 32, 128, or 512 spp');
    if (!['ready', 'complete', 'cancelled'].includes(this.state)) throw new Error(`cannot start from ${this.state}`);
    if (this._hasSamples) {
      this._clearSamples();
      this._queue(() => this.driver.reset());
    }
    this.epoch++;
    this.target = target;
    this.state = 'running';
  }

  async step() {
    if (this._pending) throw new Error('sample pending');
    if (this.state !== 'running') return false;

    const epoch = this.epoch;
    const actions = this._actions;
    let readback;
    if (!actions) {
      try {
        readback = Promise.resolve(this.driver.sample());
      } catch (error) {
        readback = Promise.reject(error);
      }
      readback.catch(() => {});
    }

    let pending;
    pending = Promise.resolve().then(async () => {
      try {
        if (actions) await actions;
        if (epoch !== this.epoch || this.state !== 'running') return false;
        const result = await (readback ?? this.driver.sample());
        if (epoch !== this.epoch || this.state !== 'running') return false;
        const {min, max, avg} = result ?? {};
        if (![min, avg, max].every(value => Number.isFinite(value) && value >= 0) || min > avg || avg > max) {
          throw new RangeError('sample counts must be finite, nonnegative, and ordered');
        }
        this.samples = {min, max, avg};
        this._hasSamples = true;
        if (min >= this.target) this.state = 'complete';
        return true;
      } catch (error) {
        if (epoch !== this.epoch || this.state !== 'running') return false;
        this.epoch++;
        this.state = 'error';
        this._clearSamples();
        throw error;
      }
    }).finally(() => {
      if (this._pending === pending) this._pending = null;
    });
    this._pending = pending;
    return pending;
  }

  invalidate(bindingKey) {
    if (Object.is(bindingKey, this.bindingKey) || ['error', 'lost', 'disposed'].includes(this.state)) return false;
    this.bindingKey = bindingKey;
    this._invalidate('ready');
    this._queue(() => this.driver.reset());
    return true;
  }

  resize(width, height) {
    if (![width, height].every(value => Number.isInteger(value) && value >= 1 && value <= 8192)) {
      throw new RangeError('dimensions must be integers from 1 through 8192');
    }
    if (['error', 'lost', 'disposed'].includes(this.state)) return false;
    this._invalidate('ready');
    this._queue(async () => {
      await this.driver.reset();
      await this.driver.resize(width, height);
    });
    return true;
  }

  cancel() {
    if (['cancelled', 'error', 'lost', 'disposed'].includes(this.state)) return;
    this._invalidate('cancelled');
    this._queue(() => this.driver.reset());
  }

  deviceLost() {
    return this._terminate('lost');
  }

  dispose() {
    return this._terminate('disposed');
  }

  async settled() {
    while (this._pending || this._actions) {
      const pending = this._pending;
      const actions = this._actions;
      if (pending) await pending.catch(() => {});
      if (actions) await actions;
    }
  }

  _invalidate(state) {
    this.epoch++;
    this.state = state;
    this._clearSamples();
  }

  _clearSamples() {
    this.samples = emptySamples();
    this._hasSamples = false;
    this.target = 0;
  }

  _terminate(state) {
    if (this._terminalPromise) return this._terminalPromise;
    this._invalidate(state);
    this._terminalPromise = this._queue(() => Promise.resolve().then(() => this.driver.dispose()), true);
    return this._terminalPromise;
  }

  _queue(action, allowFailure = false) {
    const waits = [this._actions, this._pending].filter(Boolean).map(promise => allowFailure ? promise.catch(() => {}) : promise);
    if (!waits.length) {
      let result;
      try {
        result = action();
      } catch (error) {
        this._actionFailed();
        throw error;
      }
      return isThenable(result) ? this._track(result) : Promise.resolve(result);
    }
    return this._track(Promise.all(waits).then(action));
  }

  _track(promise) {
    let tracked;
    tracked = Promise.resolve(promise).catch(error => {
      this._actionFailed();
      throw error;
    }).finally(() => {
      if (this._actions === tracked) this._actions = null;
    });
    this._actions = tracked;
    tracked.catch(() => {});
    return tracked;
  }

  _actionFailed() {
    if (['error', 'lost', 'disposed'].includes(this.state)) return;
    this._invalidate('error');
  }
}
