import HttpReader from './HttpReader.js'
import ShpReader from './ShpReader.js';
import DbfReader from './DbfReader.js'
import proj4 from '../dist/proj4.js';
import pmap from './pmap.js'
import { QixBlockReader } from './QixBlockReader.js'
import { QixReader } from './QixReader.js'
import { EagerQix } from './parseQix.js';
import checkOverlap from './checkOverlap.js';
const fixBbox = bbox => {
    return bbox.map(item => {
        if (typeof item === 'string') {
            return parseFloat(item)
        }
        return item;
    })
}
export default class COSHP {
    #cache = new Map()
    constructor(reader, blocksize) {
        if (typeof reader === 'string') {
            this.reader = new HttpReader(reader);
        } else {
            this.reader = reader;
        }
        this.shpReader = null;
        this.dbfReader = null;
        this.qixTree = null;
        this.blocksize = blocksize;
    }
    async getById(id) {
        const [shp, dbf] = await Promise.all([
            this.getShpById(id),
            this.getDbfById(id)
        ]);
        const out = {
            type: 'Feature',
            geometry: shp,
            properties: dbf

        }
        return out;
    }
    async getByIdRange(startId, endId) {
        const [shps, dbfs] = await Promise.all([
            this.getShpByIdRange(startId, endId),
            this.getDbfByIdRange(startId, endId)
        ]);
        const out = {
            type: 'FeatureCollection',
            features: []
        }
        let i = -1;
        const numRecs = shps.length;
        while (++i < numRecs) {
            out.features.push({
                type: 'Feature',
                geometry: shps[i],
                properties: dbfs[i]
            })
        }
        return out;
    }
    async getDbfById(id) {
        if (!this.dbfReader) {
            await this.createDbfReader();
        }
        const { offset, len } = this.dbfReader.getOffset(id);
        const data = await this.reader.read('dbf', offset, len);
        return this.dbfReader.parseRow(data);
    }
    async getDbfByIdRange(startId, endId) {
        if (!this.dbfReader) {
            await this.createDbfReader();
        }
        const startOffset = this.dbfReader.getOffset(startId);
        const endOffset = this.dbfReader.getOffset(endId);
        const start = startOffset.offset;
        const endPosition = endOffset.offset + endOffset.len;
        const readLength = endPosition - start;
        const numRecs = endId - startId + 1;
        const data = await this.reader.read('dbf', start, readLength);
        let offset = 0;
        let recLen = this.dbfReader.header.recLen;
        let i = -1;
        const out = [];
        while (++i < numRecs) {
            out.push(this.dbfReader.parseRow(data, offset));
            offset += recLen;
        }
        return out;
    }
    async getShpById(id) {
        if (!this.shpReader) {
            await this.createShpReader();
        }
        const { offset, length } = await this.getOffset(id);
        const data = await this.reader.read('shp', (offset + 4) * 2, length * 2);
        const geometry = this.shpReader.getRow(data);
        return geometry;
    }
    async getShpByIdRange(startID, endID) {
        const promises = [
            this.getOffset(startID),
            this.getOffset(endID)
        ]
        if (!this.shpReader) {
            promises.push(this.createShpReader());
        }
        const [startOffset, endOffset] = await Promise.all(promises);
        const numRecs = endID - startID + 1;
        const start = startOffset.offset;
        const endPosition = endOffset.offset + endOffset.length + 4;
        const readLength = endPosition - start;
        const data = await this.reader.read('shp', start * 2, readLength * 2);
        const out = [];
        const dataLength = data.byteLength;
        let currentOffset = 0;
        let currentRecord = -1;
        while (++currentRecord < numRecs) {
            const len = data.getInt32(currentOffset + 4) << 1;
            if (len === 0) {
                currentOffset += 8;
                out.push(null);
                continue;
            }
            if (currentOffset + len > dataLength) {
                return out;
            }
            currentOffset += 8;
            const rowView = new DataView(data.buffer, currentOffset, len);
            currentOffset += len;
            out.push(this.shpReader.getRow(rowView));
        }
        return out;

    }
    async getOffset(id) {
        const indexOffset = (id - 1) * 8 + 100;
        const indexRecord = await this.reader.read('shx', indexOffset, 8);
        const offset = indexRecord.getInt32(0);
        const length = indexRecord.getInt32(4);
        return { offset, length };
    }
    async createDbfReader() {
        if (this.dbfReader) {
            return;
        }
        if (this.#cache.has('dbfReaderProm')) {
            return this.#cache.get('dbfReaderProm')
        }
        this.#cache.set('dbfReaderProm', this.#createDbfReader().then(() => {
            delete this.#cache.delete('dbfReaderProm')
        }));
        return this.#cache.get('dbfReaderProm')
    }
    async #createDbfReader() {
        const [header, cpg] = await Promise.all([
            this.reader.read('dbf', 0, 12),
            this.#maybeGetCPG()
        ]);
        const dbfReader = new DbfReader(cpg);
        const rowHeaderLen = dbfReader.parseHeaders(header);
        const rowHeaderData = await this.reader.read('dbf', 32, rowHeaderLen - 32);
        dbfReader.parseRowHeaders(rowHeaderData);
        this.dbfReader = dbfReader;
    }
    async #maybeGetCPG() {
        if (this.#cache.has('cpg')) {
            return this.#cache.get('cpg');
        }
        try {
            const cpg = await this.reader.readAll('cpg');
            this.#cache.set('cpg', cpg);
            if (!cpg) {
                return;
            }
            return cpg;
        } catch (e) {
            this.#cache.set('cpg', false);
            // don't care
        }
    }
    async #maybeCreateTrans() {
        try {
            const prjFile = await this.reader.readAll('prj');
            if (!prjFile) {
                console.log('no proj file')
                this.#cache.set('prj', false);
                return;
            }
            const proj = proj4(prjFile);
            this.#cache.set('prj-raw', prjFile)
            this.#cache.set('prj', proj);
            return proj;
        } catch (e) {
            // console.log('proj err', e);
            this.#cache.set('prj', false);
            // don't care;
        }
    }
    async createShpReader() {
        if (this.shpReader) {
            return;
        }
        if (this.#cache.has('shpReaderProm')) {
            return this.#cache.get('shpReaderProm')
        }
        this.#cache.set('shpReaderProm', this.#createShpReader().then(() => {
            delete this.#cache.delete('shpReaderProm')
        }));
        return this.#cache.get('shpReaderProm')
    }
    async #createShpReader() {
        const [header, trans] = await Promise.all([
            this.reader.read('shp', 0, 100),
            this.#maybeCreateTrans()
        ]);
        this.shpReader = new ShpReader(header, trans);
    }
    async parseGeoemtry(data) {
        if (!this.shpReader) {
            await this.createShpReader();
        }
        return this.shpReader.getRow(data);
    }
    async #setUpQix() {
        // this.qixTree = new QixBlockReader(this.reader);
        this.qixTree = new QixBlockReader(this.reader, this.blocksize)
        // await this.qixTree.init();
    }
    async query(bboxRaw) {
        if (!this.qixTree) {
            await this.#setUpQix();
        }
        const bbox = fixBbox(bboxRaw)
        const queryIds = await this.qixTree.query(bbox);
        let filtered = 0;
        const results = await pmap(queryIds, async (idSet) => {
            if (idSet.type === 'range') {
                const { features } = await this.getByIdRange(idSet.start, idSet.end);
                let start = idSet.start - 1;
                const out = [];
                for (const feature of features) {
                    start++;
                    if (feature?.geometry?.bbox && checkOverlap(feature.geometry.bbox, bbox)) {
                        out.push(feature)
                        feature.id = start;
                    } else {
                        filtered++;
                    }

                    // console.log('multi', feature)
                }
                if (out.length) {
                    return out;
                }
            } else {
                const row = await this.getById(idSet.id);
                if (row?.geometry?.bbox && checkOverlap(row.geometry.bbox, bbox)) {
                    row.id = idSet.id;
                    // console.log('not filtered', row.properties.GEOID)
                    return [row];
                } else {
                    // console.log('filtered', row.properties.GEOID);
                    // return [row]
                    // console.log('sing', feature)
                    filtered++;
                    return;
                }
            }
        })
        const out = results.filter(item => item).flat();
        console.log('filtered', filtered);

        return {
            type: 'FeatureCollection',
            features: out
        }
    }
    async close() {
        if (this.reader.close) {
            await this.reader.close();
        }
    }
}