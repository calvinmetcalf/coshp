
const extentions = new Set(['shp', 'dbf', 'cpg', 'prj', 'shx', 'qix']);
export default class FileReader {
    constructor(path) {
        if (path.endsWith('.shp')) {
            path = path.slice(0, -4);
        }
        this.base = path;
        this.stats = new Map();
    }
       recordCall(type, length) {
        let stuff = this.stats.get(type);
        if (!stuff) {
            stuff = {
                size: 0,
                calls: 0
            }
        }
        stuff.calls++;
        stuff.size += length;
        this.stats.set(type, stuff);
    }
    async getLength(ext) {
        const path = this.makePath(type);
        const req = await fetch(path, { method: 'head' });
        if (req.ok) {
            return req.headers.get('content-length');
        } else {
            throw new Error(req.statusText)
        }
    }
    makePath(ext) {
        if (!extentions.has(ext)) {
            throw new Error('invalid extention');
        }
        return `${this.base}.${ext}`;
    }
    async readAll(type, dataView) {
        const path = this.makePath(type);
        const req = await fetch(path);
        if (req.status > 299) {
            throw new Error(req.statusText);
        }
        if (!dataView) {
            return req.text();
        }
        const arrayBuffer = await req.arrayBuffer();
        this.recordCall(type, arrayBuffer.byteLength)
        return new DataView(arrayBuffer)
    }
    async read(type, offset, length) {
        const path = this.makePath(type);
        const req = await fetch(path, {
            headers: {
                range: `bytes=${offset}-${offset + length - 1}`,
                'Accept-Encoding': 'identity'
            }
        });
        if (req.status > 299) {
            throw new Error(req.statusText);
        }
        const arrayBuffer = await req.arrayBuffer();
        this.recordCall(type, length)
        return new DataView(arrayBuffer)
    }
    async close() { }
}