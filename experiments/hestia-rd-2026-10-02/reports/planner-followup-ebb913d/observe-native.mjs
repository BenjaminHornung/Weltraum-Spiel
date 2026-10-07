/** Observe real WebGL object ownership/compiler/programs. Never replaces a GL result. */
export function observeNative() {
  const live = {}, created = {}, deleted = {}, events = [];
  const state = window.__rdNative = { live, created, deleted, events, compiled: [], linked: [], draws: [], inject: null };
  const p = WebGL2RenderingContext.prototype;
  for (const type of ['Buffer', 'Texture', 'Program', 'Shader', 'Framebuffer', 'VertexArray', 'Renderbuffer', 'Query', 'Sampler', 'TransformFeedback']) {
    const owned = new Set(), create = p['create' + type], remove = p['delete' + type];
    created[type] = deleted[type] = live[type] = 0;
    p['create' + type] = function (...args) { const value = create.apply(this, args); if (value) { owned.add(value); created[type]++; live[type] = owned.size; } return value; };
    p['delete' + type] = function (value) { const result = remove.call(this, value); if (owned.delete(value)) deleted[type]++; live[type] = owned.size; return result; };
  }
  const source = p.shaderSource, compile = p.compileShader, link = p.linkProgram, error = p.getError;
  p.shaderSource = function (shader, code) {
    if (state.inject === 'compile' && this.getShaderParameter(shader, this.SHADER_TYPE) === this.FRAGMENT_SHADER) {
      state.inject = null; events.push({ injected: 'actual-fragment-compile-error', created: { ...created }, live: { ...live } });
      code += '\n#error FOLLOWUP_INTENTIONAL_NATIVE_COMPILE_FAILURE\n';
    }
    return source.call(this, shader, code);
  };
  p.compileShader = function (shader) { const result = compile.call(this, shader);
    state.compiled.push({ type: this.getShaderParameter(shader, this.SHADER_TYPE), ok: this.getShaderParameter(shader, this.COMPILE_STATUS),
      log: this.getShaderInfoLog(shader), code: this.getShaderSource(shader), live: { ...live } }); return result; };
  p.linkProgram = function (program) {
    if (state.inject === 'link') { state.inject = null; const fragment = this.getAttachedShaders(program).find(s => this.getShaderParameter(s, this.SHADER_TYPE) === this.FRAGMENT_SHADER);
      this.detachShader(program, fragment); events.push({ injected: 'actual-missing-fragment-link-error', created: { ...created }, live: { ...live } }); }
    const result = link.call(this, program);
    state.linked.push({ ok: this.getProgramParameter(program, this.LINK_STATUS), log: this.getProgramInfoLog(program), live: { ...live } }); return result;
  };
  p.getError = function () { const result = error.call(this); if (result) events.push({ nativeError: result }); return result; };
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const draw = p[name]; p[name] = function (...args) {
      const program = this.getParameter(this.CURRENT_PROGRAM), linked = Boolean(program && this.getProgramParameter(program, this.LINK_STATUS));
      const result = draw.apply(this, args); state.draws.push({ name, linkedProgram: linked }); return result;
    };
  }
}
