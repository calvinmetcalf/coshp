import checkOverlap from './checkOverlap.js'
import hilbert from './hilbert-math.js'
const updateBbox = (old, nw) => {
    if (nw[0] < old[0]) {
        old[0] = nw[0]
    }
    if (nw[1] < old[1]) {
        old[1] = nw[1]
    }
    if (nw[2] > old[2]) {
        old[2] = nw[2]
    }
    if (nw[3] > old[3]) {
        old[3] = nw[3]
    }
}
const pullOutLeftovers = (inputIds, area) => {
    const ids = [];
    const leftovers = [];
    for (const id of inputIds) {
        if (!id.area) {
            id.area = (id.bbox[2]-id.bbox[0]) * (id.bbox[3]-id.bbox[1])
        }
        if (id.area > area/2) {
            leftovers.push(id)
        } else {
            ids.push(id)
        }
    }
    return {ids, leftovers}
}
const sortXY = (ids, X) => {
    ids.sort((a, b) => {
        if (!a.center) {
            a.center = [
               a.bbox[0] +  (a.bbox[2] - a.bbox[0])/2,
                a.bbox[1] +  (a.bbox[3] - a.bbox[1])/2
            ]
        }
         if (!b.center) {
            b.center = [
               b.bbox[0] +  (b.bbox[2] - b.bbox[0])/2,
                b.bbox[1] +  (b.bbox[3] - b.bbox[1])/2
            ]
        }
        const comp = X ? 0:1;
        return a.center[comp] - b.center[comp];
    })
}
const makeBbox = (ids) => {
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const id of ids) {
        updateBbox(bbox, id.bbox);
    }
    return bbox
}
const makeSplit = (ids, bbox) => {

    const xLen = bbox[2] - bbox[0];
    const yLen = bbox[3] - bbox[1];
    const dir = xLen>yLen

    sortXY(ids, dir)
    let len = ids.length;
    let overhang = 0;
    if (len%2) {
        overhang++;
    }
    const low = ids.slice(0, len/2);
    const high = ids.slice(len/2);
    return [
        {
            ids:low, bbox:makeBbox(high),
        }, 
        {
            ids: high, bbox: makeBbox(low)
        }
    ]
}
class QixNode {
    constructor(ids, {nodeSize, leafSize, depth=0, strategy, prefix=''}) {
        this.depth= depth + 1;
        this.ids = [];
        this.strategy = strategy;
        this.prefix = prefix;
        this.bbox = [Infinity, Infinity, -Infinity, -Infinity]
        for (const id of ids) {
            this.ids.push(id);
            updateBbox(this.bbox, id.bbox);
        }
        this.area = (this.bbox[2]-this.bbox[0]) * (this.bbox[3]-this.bbox[1])
        this.nodeSize = nodeSize;
        this.leafSize = leafSize;
        this.leaf = false;
        this.children = []
        this.split()
    }
    getOpts(args={}) {
        return {
            nodeSize: this.nodeSize,
            leafSize: this.leafSize,
            depth: this.depth,
            strategy: this.strategy,
            prefix: this.prefix,
            ...args
        }
    }
    split() {
        if (this.ids.length <= this.leafSize) {
            this.leaf = true;
            return;
        }
        if (this.strategy === 'hybrid') {
            return this.splitHybrid();
        }
        if (this.strategy === 'topdown') {
            return this.splitNoHilbert();
        }
        if (this.strategy === 'hilbertquad') {
            return this.hilbertQuad();
        }
    }
    splitPureHilbert() {
        if (this.depth === 1) {
            this.addHilbert();
        }
        this.hilbertSplit();
    }
    splitNoHilbert() {
        if (this.ids.length > this.leafSize * 2) {
            this.quadSplit();
        } else {
            this.biSplit();
        }
    }
    splitHybrid() {
        if (this.depth === 2) {
            this.addHilbert();
        }
        if (this.depth === 1 || this.depth + 1 >= this.maxDepth) {
            if (this.ids.length > this.nodeSize * 3) {
                this.quadSplit();
            } else {
                this.biSplit();
            }
        } else {
            this.hilbertSplit();
        }
    
    }
 
    getHeight() {
        if (this.leaf) {
            return 1;
        } 
        return Math.max(...this.children.map(child=>child.getHeight()));
    }
    updateBbox() {
        this.bbox = [Infinity, Infinity, -Infinity, -Infinity]
        for (const id of this.ids) {
            updateBbox(this.bbox, id.bbox);
        }
        for (const child of this.children) {
            child.updateBbox();
            updateBbox(this.bbox, child.bbox);
        }
    }
    hilbertSplit() {
        const {leftovers, ids} = pullOutLeftovers(this.ids, this.area);
        this.ids = leftovers;
        let len = ids.length;
        let overhang = len % 32;
        if (overhang) {
           overhang = 32 - overhang;
        }
        len += overhang;
        const size = len/4;
        const splits = [ids.slice(0, size), ids.slice(size, size*2), ids.slice(size*2, size*3), ids.slice(size*3)];
        this.children = splits.map(item=>new QixNode(item, this.getOpts()));
    }
    hilbertQuad() {
        if (this.depth === 1) {
            this.addHilbert();
        }
        const ids = this.ids;
        this.ids = [];
        const newPrefixes = [this.prefix + '0', this.prefix + '1',this.prefix + '2',this.prefix + '3'];
        const newArrs = [[],[],[],[]];
        for (const row of ids) {
            let i = -1;
            while (++i < 4) {
                if (row.hilbertQuad.startsWith(newPrefixes[i])) {
                    newArrs[i].push(row);
                    break;
                }
            }
        }
        this.children = [];
        let i = -1;
        while (++i < 4) {
            const arr = newArrs[i];
            if (!arr.length) {
                continue;
            }
            this.children.push(new QixNode(arr, this.getOpts({prefix: newPrefixes[i]})));
        }
    }
    biSplit() {
        const {leftovers, ids} = pullOutLeftovers(this.ids, this.area);
        const [low, high] = makeSplit(ids, this.bbox);
        this.ids = leftovers;
        this.children = [new QixNode(low.ids, this.getOpts()),new QixNode(high.ids, this.getOpts())]
    }
     quadSplit() {
        const {leftovers, ids} = pullOutLeftovers(this.ids, this.area);
        const [low, high] = makeSplit(ids, this.bbox);
        const splitTwo = [...makeSplit(low.ids, low.bbox), ...makeSplit(high.ids, high.bbox)]
        this.ids = leftovers;
        this.children = splitTwo.map(item=>new QixNode(item.ids, this.getOpts()));
    }
     addHilbert() {
        const width = (this.bbox[2] - this.bbox[0]) || 1;
        const height = (this.bbox[3] - this.bbox[1]) || 1;
        const hilbertMax = (1 << 16) - 1;
        this.ids.forEach(row => {
            const x = Math.floor(hilbertMax * ((row.bbox[0] + row.bbox[2]) / 2 - this.bbox[0]) / width);
            const y = Math.floor(hilbertMax * ((row.bbox[1] + row.bbox[3]) / 2 - this.bbox[1]) / height);
            row.hilbert = hilbert(x, y);
            row.hilbertQuad = row.hilbert.toString(4).padStart(16, '0')
        });
        this.ids.sort((a, b) =>
            a.hilbert - b.hilbert
        );

    }
    intersects(bbox) {
        return checkOverlap(bbox, this.bbox);
    }
    length() {
        return  (44 + this.ids.length * 4);
    }
    totalLength() {
        let length =this.length();
        for (const child of this.children) {
            length += child.totalLength();
        }
        return length;
    }
    serializeSelf(byteOrder, array, offset) {
        this.updateBbox();
        array.setUint32(offset, this.totalLength() - 44 - this.ids.length * 4, byteOrder);
        array.setFloat64(offset + 4, this.bbox[0], byteOrder);
        array.setFloat64(offset + 12, this.bbox[1], byteOrder);
        array.setFloat64(offset + 20, this.bbox[2], byteOrder);
        array.setFloat64(offset + 28, this.bbox[3], byteOrder);
        array.setUint32(offset + 36, this.ids.length, byteOrder);
        let i = 0;
        for (const {id} of this.ids) {
            array.setUint32(offset + 40 + (i * 4), id - 1, byteOrder);
            i++;
        }
        array.setUint32(offset + 40 + (i * 4), this.children.length, byteOrder);
    }
    serialize(byteOrder, array, offset) {
        this.serializeSelf(byteOrder, array, offset);
        if (this.leaf) {
            return;
        }
        let newOffset = offset + this.length();
        for (const child of this.children) {
            child.serialize(byteOrder, array, newOffset);
            newOffset += child.totalLength();

        }
        return;
    }
}

class Qix {
    constructor(strategy='hybrid') {
        this.offset = 100;
        this.trust = false;
        this.bbox = [Infinity, Infinity, -Infinity, -Infinity]
        this.rows = [];
        this.root = null;
        this.nodeSize = 4;
        this.leafSize = 8;
        this.strategy = strategy;
        this.maxDepth = null;
    }
    updateBbox(bbox) {
        updateBbox(this.bbox, bbox);
    }
    createTree() {
        this.root = new QixNode(this.rows, {
            nodeSize: this.nodeSize,
            leafSize: this.leafSize,
            strategy: this.strategy
        })
    }
    outputBinary(byteOrder = false) {
        const length = 16 + this.root.totalLength();
        const arr = new ArrayBuffer(length);
        const view = new DataView(arr);
        view.setUint8(0, 83); //'S';
        view.setUint8(1, 81); //'Q';
        view.setUint8(2, 84); //'T';
        const byteOrdermark = byteOrder ? 1 : 2;
        view.setUint8(3, byteOrdermark);
        view.setUint8(4, 1);
        view.setUint32(8, this.rows.length, byteOrder);
        view.setUint32(12, this.root.getHeight(), byteOrder);

        this.root.serialize(byteOrder, view, 16);

        return view;
    }
    handleRow(id, bbox) {
        this.updateBbox(bbox);
        this.rows.push({ id, bbox });
    }
    injestShp(data) {
        while (this.offset + 8 < data.byteLength) {
            const id = data.getUint32(this.offset);
            const length = data.getUint32(this.offset + 4) * 2;
            this.offset += 8;
            if (length === 0) {
                continue;
            }
            const shpType = data.getUint32(this.offset, true);
            switch (shpType) {
                case 1:
                case 11:
                case 21: {
                    const x = data.getFloat64(this.offset + 4, true);
                    const y = data.getFloat64(this.offset + 12, true);
                    const bbox = [x, y, x, y];
                    this.handleRow(id, bbox);
                    this.offset += length;
                    break;
                }
                case 3:
                case 5:
                case 8:
                case 13:
                case 15:
                case 18:
                case 23:
                case 25:
                case 28: {
                    const bbox = [
                        data.getFloat64(this.offset + 4, true),
                        data.getFloat64(this.offset + 12, true),
                        data.getFloat64(this.offset + 20, true),
                        data.getFloat64(this.offset + 28, true)
                    ];
                    this.handleRow(id, bbox);
                    this.offset += length;
                    break;
                }
                default: {
                    this.offset += length;
                }
            }
        }
    }
}
export default (data, strategy) => {
    const qix = new Qix(strategy);
    qix.injestShp(data);
    qix.createTree();
    return qix.outputBinary();
}

