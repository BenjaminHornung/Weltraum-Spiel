declare module '*.css';
declare module '*@playwright/test/index.mjs' {
  export const test:typeof import('../../../../../apps/weltraum-browser/node_modules/@playwright/test').test;
  export const expect:typeof import('../../../../../apps/weltraum-browser/node_modules/@playwright/test').expect;
  export type Page=import('../../../../../apps/weltraum-browser/node_modules/@playwright/test').Page;
}
declare module '*three/build/three.module.js' {
  export const Quaternion:typeof import('../../../../../apps/weltraum-browser/node_modules/@types/three').Quaternion;
  export const Vector3:typeof import('../../../../../apps/weltraum-browser/node_modules/@types/three').Vector3;
}
