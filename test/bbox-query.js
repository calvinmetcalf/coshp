import shpjs from 'shpjs'
import fs from 'fs/promises'
import checkOverlap from '../src/checkOverlap.js';
const getFile = async (file, ext) => fs.readFile(`${import.meta.dirname}/data/${file}.${ext}`);

export default async (file, bbox) => {
    const [shp, dbf, prj, cpg] = await Promise.all([
        getFile(file, 'shp'),
        getFile(file, 'dbf'),
        getFile(file, 'prj').catch(() => false),
        getFile(file, 'cpg').catch(() => false)
    ]);
    const geojson = await shpjs({ shp, dbf, prj, cpg });
    if (!bbox) {
        return geojson;
    }
    return {
        type: 'FeatureCollection',
        features: geojson.features.filter(({ geometry }) => checkOverlap(geometry.bbox, bbox))
    }
}