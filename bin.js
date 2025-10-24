#!/usr/bin/env node
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers';
import buildQix from './src/generateQix.js';
import buildQixTopDown from './src/generateTopDownQix.js';
import reorder from './src/reorder.js';
import fs from 'fs/promises';
const argv = yargs(hideBin(process.argv))
.command('build <filepath>', 'build a qix file', {
    algo:{
        alias:'a',
        describe:'choose an algorithem for use when building a qix file',
        choices:  ['topdown', 'bottomup'],
        default: ['bottomup']
    }
})
.command('reorder <filepath>', 'reorder a shape file based ona qix', {
    suffix: {
        alias: 's',
        describe: 'suffix to append to reordered files',
        default: '-ordered'
    }
})
.alias('h', 'help')
.help()
.argv


const command = argv._[0];
if (command !== 'build' && command !== 'reorder') {
    console.log('please select a command of "build" or "reorder"');
    process.exit(1);
}
let path = argv.filepath
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
    let builder = buildQix;
    if (argv.a === 'topdown') {
        builder = buildQixTopDown;
    }
    const out = builder(view);
    const toWrite = new Uint8Array(out.buffer);
    await fs.writeFile(`${path}.qix`, toWrite);
    console.log(".qix file generated")
    process.exit();
}


if (command === 'reorder') {
    await reorder(path, argv.s);
    process.exit();
}