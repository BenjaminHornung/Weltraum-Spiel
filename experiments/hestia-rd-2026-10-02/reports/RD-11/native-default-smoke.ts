// Current diagnostic: supported pinned Lambert defaults plus the retained real TSL opacity input.
// compiler-smoke.ts remains unchanged as the original colorNode-assignment timeout reproducer.
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { materialOpacity } from 'three/tsl';
const material = new MeshLambertNodeMaterial();
material.opacityNode = materialOpacity;
material.emissive.copy(material.color);
