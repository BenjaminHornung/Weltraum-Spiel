export {rainVelocityMps,rainDirection,buildRainColumns,createRainDepthProjection,compareRainDepthProjection,mountThreeEffect as mountRain} from '../inputs/rd/src/experiments/rain';
export {ownerPose} from '../inputs/rd/src/runner/threeHost';
export {sampleRainTrajectory,createVoxelSourceIndex,sampleRainExposure} from '../inputs/rd/src/experiments/rain-shield';
export {applyWindInputs} from '../inputs/rd/src/experiments/foliage-wind';
export {sampleAnalyticWetness,DEFAULT_WETNESS_PRESET} from '../inputs/rd/src/experiments/wet-surface';
export {importFixture,copyFixturePayload} from '../inputs/rd/src/contracts/fixture';
export {surfaceMaterial,setWind,glUniforms} from '../inputs/gfx/src/materials';
export {createDepthCameraPort,assertOwner,windInputs} from '../inputs/gfx/src/port';
import type {Material,Vector3} from 'three';
/** Preserve GFX hooks while shading in the same restored tangent frame as the volume atlas. */
export function bindRestoredOrigin(material:Material,origin:{value:Vector3}){
 const original=material.onBeforeCompile.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{original(shader,renderer);shader.uniforms.uRestoredOrigin=origin;
  shader.vertexShader='uniform vec3 uRestoredOrigin;\n'+shader.vertexShader.replace('vHvpWorld=(modelMatrix*vec4(transformed,1.0)).xyz;','vHvpWorld=(modelMatrix*vec4(transformed,1.0)).xyz+uRestoredOrigin;');
  shader.fragmentShader='uniform vec3 uRestoredOrigin;\n'+shader.fragmentShader.replace('cameraPosition-vHvpWorld','cameraPosition+uRestoredOrigin-vHvpWorld');
 };
}
