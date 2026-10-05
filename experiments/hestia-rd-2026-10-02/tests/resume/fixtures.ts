import { readFileSync } from 'node:fs';
import { loadInventory, loadReplay } from '../../src/runner/assets';
const root=new URL('http://127.0.0.1:5280/');
const fetcher:typeof fetch=async(input)=>new Response(readFileSync(new URL(`../../fixtures${new URL(String(input)).pathname}`,import.meta.url)));
/** Tests use the same pinned inventory/import/replay validation as the browser, never raw fake fixture casts. */
export async function fixtureReplay(id:string){return loadReplay(await loadInventory(root,fetcher),id,root,fetcher);}
