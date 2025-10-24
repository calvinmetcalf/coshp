import COSHP from "../coshp.js";
import fs from 'fs/promises';
import fsNorm from 'fs';
import { parseData } from "./parseQix.js";
import FileReader from './FileReader.js'

const copyHeader = async (out, coshp, file, length) => {
    const data = await coshp.reader.read(file, 0, length);
    out.write(new Uint8Array(data.buffer));
    if (file === 'qix') {
        const thing = data.getUint8(3);
        return thing !== 2;
    }
}
const copyDBFHEader = async (out, coshp) => {
    if (!coshp.dbfReader) {
        await coshp.createDbfReader();
    }
    const len = coshp.dbfReader.header.headerLen;
    const data = await coshp.reader.read('dbf', 0, len); 
    out.write(new Uint8Array(data.buffer));
}
const packShx = (offset, length) => {
    const view = new DataView(new ArrayBuffer(8));
    view.setInt32(0, offset);
    view.setInt32(4, length);
    return new Uint8Array(view.buffer);
};
const packQix = (object, lilendian) => {
    const buffer = new ArrayBuffer(object.length);
    const view = new DataView(buffer);
    view.setUint32(0, object.nextSiblingOffset, lilendian);
    view.setFloat64(4, object.bbox[0], lilendian)
    view.setFloat64(12, object.bbox[1], lilendian)
    view.setFloat64(20, object.bbox[2], lilendian)
    view.setFloat64(28, object.bbox[3], lilendian)
    view.setUint32(36, object.numShapes, lilendian);
    let i = 0;
    while (i < object.numShapes) {
        view.setUint32(40 + i * 4, object.ids[i], lilendian)
        i++;
    }
    view.setUint32(40 + i * 4, object.children, lilendian);
    return new Uint8Array(buffer);
}
export default async (path, suffix='-ordered') => {
    const coshp = new COSHP(new FileReader(path));
    const outPrefix = `${path}${suffix}`;
    const rawQix = await coshp.reader.readAll('qix', true);
    const qixIndex = parseData(rawQix);
    const outShp = fsNorm.createWriteStream(`${outPrefix}.shp`);
    const outDbf = fsNorm.createWriteStream(`${outPrefix}.dbf`);
    const outShx = fsNorm.createWriteStream(`${outPrefix}.shx`);
    const outQix = fsNorm.createWriteStream(`${outPrefix}.qix`);
    await copyHeader(outShp, coshp, 'shp', 100);
    await copyDBFHEader(outDbf, coshp);
    await copyHeader(outShx, coshp, 'shx', 100);
    const lilendian = await copyHeader(outQix, coshp, 'qix', 16);
    let prevIndex = -1;
    let shpOffset = 50;
    const idset = new Set();
    for (const qixEntry of qixIndex) {
        // console.log('entry', qixEntry);
        if (!qixEntry.numShapes) {
            outQix.write(packQix(qixEntry, lilendian));
            continue;
        }
        const ids = qixEntry.ids;
        const newIds = [];

        for (const oldId of ids) {
            if (idset.has(oldId)) {
                console.log('dup')
                continue;
            } else {
                idset.add(oldId);
            }
            prevIndex++;
            const newId = prevIndex;
            newIds.push(newId);
            const shpDetails = await coshp.getOffset(oldId + 1);
            outShx.write(packShx(shpOffset, shpDetails.length));
            shpOffset += shpDetails.length;
            shpOffset += 4;
            const shpData = await coshp.reader.read('shp', shpDetails.offset * 2, (shpDetails.length + 4) * 2);
            shpData.setUint32(0, newId + 1);
            outShp.write(new Uint8Array(shpData.buffer));
            const { offset, len } = coshp.dbfReader.getOffset(oldId + 1);
            const data = await coshp.reader.read('dbf', offset, len);
            outDbf.write(new Uint8Array(data.buffer));
        }

        qixEntry.ids = newIds;
        outQix.write(packQix(qixEntry, lilendian));
    }
    outShp.end();
    outDbf.end();
    outShx.end();
    outQix.end();
    if (!coshp.shpReader) {
        await coshp.createShpReader();
    }
    if (coshp.cache.get('prj-raw')) {
        console.log('writing prj')
        await fs.writeFile(`${outPrefix}.prj`, coshp.cache.get('prj-raw'));
    }
    if (coshp.cache.get('cpg')) {
        console.log('writing cpg')
        await fs.writeFile(`${outPrefix}.cpg`, coshp.cache.get('cpg'));
    }
    console.log('done')
}