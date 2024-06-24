
import { open, readFile } from 'fs/promises'
const extentions = new Set(['shp', 'dbf', 'cpg', 'prj', 'shx', 'qix']);
export default class FileReader {
    constructor(path) {
        this.base = path;
        this.readers = new Map();
        this.open = true;
    }
    async readAll(type, dataView) {
        if (!extentions.has(type)) {
            throw new Error('invalid extention');
        }
        const path = `${this.base}.${type}`;
        let out = await readFile(path);
        let outlen = out.length;
        if (dataView) {
            out = new DataView(out.buffer);
        } else {
            out = out.toString('utf8');
        }
        return out;
    }
    async read(type, offset, length) {
        if (!this.open) {
            throw new Error('reader is closed')
        }
        if (!this.readers.has(type)) {
            if (!extentions.has(type)) {
                throw new Error('invalid extention');
            }
            await this.createReader(type);
        }
        const reader = this.readers.get(type);
        const out = new DataView(new ArrayBuffer(length));
        await reader.read(out, 0, length, offset);
        return out;
    }
    async createReader(type) {
        // todo allow multiple callers here
        const path = `${this.base}.${type}`;
        const reader = await open(path);
        this.readers.set(type, reader);
    }
    async close() {
        if (!this.open) {
            throw new Error('already closed');
        }
        this.open = false;
        for (const [_, reader] of this.readers) {
            await reader.close();
        }
    }
}