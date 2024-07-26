#!/usr/bin/env node
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers';
import buildQix from './src/generateQix.js';
import reorder from './src/reorder.js';
import fs from 'fs/promises';
const argv = yargs(hideBin(process.argv)).argv


const command = argv._[0];
if (command !== 'build' && command !== 'reorder') {
    console.log('please select a command of "build" or "reorder"');
    process.exit(1);
}
let path = argv._[1];
if (!path) {
    console.log('please supply a file path');
    process.exit(2)
}
if (path.endsWith('.shp')) {
    path = path.slice(0, -4);
}
if (command === 'build') {
    const data = await fs.readFile(`${path}.shp`);
    const view = new DataView(data.buffer);
    const out = buildQix(view);
    const toWrite = new Uint8Array(out.buffer);
    await fs.writeFile(`${path}.qix`, toWrite);
    process.exit();
}


if (command === 'reorder') {
    await reorder(path);
    process.exit();
}