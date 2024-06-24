
const extentions = new Set(['shp', 'dbf', 'cpg', 'prj', 'shx', 'qix']);
export default class FileReader {
    constructor(path) {
        this.base = path;
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
        return new DataView(arrayBuffer)
    }
    async read(type, offset, length) {
        const path = this.makePath(type);
        const req = await fetch(path, {
            headers: {
                range: `bytes=${offset}-${offset + length}`
            }
        });
        if (req.status > 299) {
            throw new Error(req.statusText);
        }
        const arrayBuffer = await req.arrayBuffer();
        return new DataView(arrayBuffer)
    }
    async close() { }
}