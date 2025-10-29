#!/usr/bin/env node
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers';
import buildQix from './src/generateQix.js';
import buildQixHybrid from './src/generateTopDownQix.js';
import reorder from './src/reorder.js';
import fs from 'fs/promises';
const argv = yargs(hideBin(process.argv))
.command('build <filepath>', 'build a qix file', {
    algo:{
        alias:'a',
        describe:'choose an algorithem for use when building a qix file',
        choices:  ['topdown', 'bottomup', 'hybrid', 'hilbertquad'],
        default: 'bottomup'
    },
    leafsize: {
        alias:'l',
        describe: 'how many shapes should be in the final node (only used with bottomup)',
        default: 8
    },
      nodesize: {
        alias:'n',
        describe: 'how many nodes should be contained by each parent node (only used with bottomup)',
        default: 4
    },
    swap: {
        alias: 's',
        describe: 'should we try to swap shapes between adjasent nodes to make them more compact?',
        boolean: true
    },
    promote: {
        alias: 'p',
        describe: 'should we try to promote shapes up to a higher level is their bbox cover more then 60% of their parents bbox',
        boolean: true
    }
})
.command('reorder <filepath>', 'reorder a shape file based on a qix', {
    suffix: {
        alias: 's',
        describe: 'suffix to append to reordered files',
        default: 'ordered'
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
    const opts = {};
    if (argv.swap) {
        opts.swap = argv.swap;
    }
    if (argv.promote) {
        opts.promote = argv.promote;
    }
    let out;
    if (argv.a === 'bottomup') {
       out = buildQix(view, argv.n, argv.l, opts);  
    } else {
        out = buildQixHybrid(view, argv.a);  
    }
 
    const toWrite = new Uint8Array(out.buffer);
    await fs.writeFile(`${path}.qix`, toWrite);
    console.log(".qix file generated")
    process.exit();
}


if (command === 'reorder') {
    await reorder(path, argv.s);
    process.exit();
}