import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root} from './bindings.mjs';
import {prepareFixtures} from '../src/fixture.mjs';
mkdirSync(resolve(root,'fixtures'),{recursive:true});await prepareFixtures();
