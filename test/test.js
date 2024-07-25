import query from './bbox-query.js';
import test from 'tape'
import COSHP from '../index.js'
import FileReader from '../FileReader.js'
import shpjs from 'shpjs';
import { parseData } from '../parseQix.js';
import fs from 'fs/promises'
const makeCoshp = path => {
    return new COSHP(new FileReader(`${import.meta.dirname}/data/${path}`))
}
const bbox = [-71.07169389724733, 42.351566891364364, -71.03729724884035, 42.36442621717192];
test('basic', async t => {
    t.plan(1);

    const shp = makeCoshp('blockgroups-ordered');
    const results = await shp.query(bbox);
    // const results = await query('blockgroups-ordered', bbox);
    const compare = await query('blockgroups-ordered', bbox);
    await shp.close();

    t.deepEqual(results.features.map(item => item.properties.GEOID).sort(), compare.features.map(item => item.properties.GEOID).sort())
})
// test('qix', async t => {
//     t.plan(2);
//     const qixFile = await fs.readFile('./test/data/blockgroups-ordered.qix');
//     const rows = parseData(new DataView(qixFile.buffer));
//     const set = new Set();
//     const arr = [];
//     const geojson = await query('blockgroups-ordered');
//     let i = -1;
//     let ID;
//     while (++i < geojson.features.length) {
//         if (geojson.features[i].properties.GEOID === '250250702021' /*'250259901010'*/) {
//             console.log('i', i + 1);
//             console.log('json', geojson.features[i])
//             ID = i + 1;
//         }
//     }
//     for (const row of rows) {
//         for (const id of row.ids) {
//             if (id === ID) {
//                 console.log('row', row);
//             }
//         }
//     }
//     t.equal(set.size, arr.length);

//     t.equal(arr.length, geojson.features.length);
// })