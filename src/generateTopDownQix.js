/*
* Based upon https://github.com/mourner/flatbush/blob/5729a98facd94a66038b7772906f78cd22249336/index.js (ISC Vladimir Agafonkin)
*/
import checkOverlap from './checkOverlap.js'

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
const chunk = (size, target) => {
    const out = [];
    let rem = size % target;
    const num = Math.floor(size / target);
    let i = 0;
    while (i < num) {
        out.push(target);
        i++;
    }

    if (rem > target / 2) {
        out.push(rem);
        return out;
    }
    i = out.length - 1;
    while (rem <= target / 2) {
        rem++;
        out[i]--;
        i--;
        if (i < 0) {
            i = out.length - 1;
        }
    }
    out.push(rem);
    return out;
};
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
    sortXY(ids, xLen>yLen)
    let len = ids.length;
    if (len % 2) {
        len ++;
    }
    const low = ids.slice(0, len/2);
    const high = ids.slice(len/2);
    return [
        {
            ids:low, bbox:makeBbox(low),
        },
        {
            ids: high, bbox: makeBbox(high)
        }
    ]
}
class QixNode {
    constructor(ids, nodeSize, leafSize, depth=0) {
        this.depth= depth + 1;
        this.ids = [];
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
        if (this.ids.length > leafSize) {
            if (this.ids.length > nodeSize * 3) {
                this.quadSplit();
            } else {
                this.split();
            }
        } else {
            this.leaf = true;
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
    split() {
        const {leftovers, ids} = pullOutLeftovers(this.ids, this.area);
        const [low, high] = makeSplit(ids, this.bbox);
        this.ids = leftovers;
        this.children = [new QixNode(low.ids, this.nodeSize, this.leafSize, this.depth),new QixNode(high.ids, this.nodeSize, this.leafSize, this.depth)]
    }
     quadSplit() {
        const {leftovers, ids} = pullOutLeftovers(this.ids, this.area);
        const [low, high] = makeSplit(ids, this.bbox);
        const splitTwo = [...makeSplit(low.ids, low.bbox), ...makeSplit(high.ids, high.bbox)]
        this.ids = leftovers;
        this.children = splitTwo.map(item=>new QixNode(item.ids, this.nodeSize, this.leafSize, this.depth));
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
    constructor(nodeSize = 4, leafSize = 8) {
        this.offset = 100;
        this.bbox = [Infinity, Infinity, -Infinity, -Infinity]
        this.rows = [];
        this.root = null;
        this.nodeSize = nodeSize;
        this.leafSize = leafSize;
        this.maxDepth = null;
    }
    updateBbox(bbox) {
        updateBbox(this.bbox, bbox);
    }
    createTree() {
        this.root = new QixNode(this.rows, this.nodeSize, this.leafSize)
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
export default (data, nodeSize, leafSize) => {
    const qix = new Qix(nodeSize, leafSize);
    qix.injestShp(data);
    qix.createTree();
    return qix.outputBinary();
}


/**
 * Fast Hilbert curve algorithm by http://threadlocalmutex.com/
 * Ported from C++ https://github.com/rawrunprotected/hilbert_curves (public domain)
 * taken from https://github.com/mourner/flatbush/blob/5729a98facd94a66038b7772906f78cd22249336/index.js (ISC, Vladimir Agafonkin)
 */
function hilbert(x, y) {
    let a = x ^ y;
    let b = 0xFFFF ^ a;
    let c = 0xFFFF ^ (x | y);
    let d = x & (y ^ 0xFFFF);

    let A = a | (b >> 1);
    let B = (a >> 1) ^ a;
    let C = ((c >> 1) ^ (b & (d >> 1))) ^ c;
    let D = ((a & (c >> 1)) ^ (d >> 1)) ^ d;

    a = A; b = B; c = C; d = D;
    A = ((a & (a >> 2)) ^ (b & (b >> 2)));
    B = ((a & (b >> 2)) ^ (b & ((a ^ b) >> 2)));
    C ^= ((a & (c >> 2)) ^ (b & (d >> 2)));
    D ^= ((b & (c >> 2)) ^ ((a ^ b) & (d >> 2)));

    a = A; b = B; c = C; d = D;
    A = ((a & (a >> 4)) ^ (b & (b >> 4)));
    B = ((a & (b >> 4)) ^ (b & ((a ^ b) >> 4)));
    C ^= ((a & (c >> 4)) ^ (b & (d >> 4)));
    D ^= ((b & (c >> 4)) ^ ((a ^ b) & (d >> 4)));

    a = A; b = B; c = C; d = D;
    C ^= ((a & (c >> 8)) ^ (b & (d >> 8)));
    D ^= ((b & (c >> 8)) ^ ((a ^ b) & (d >> 8)));

    a = C ^ (C >> 1);
    b = D ^ (D >> 1);

    let i0 = x ^ y;
    let i1 = b | (0xFFFF ^ (i0 | a));

    i0 = (i0 | (i0 << 8)) & 0x00FF00FF;
    i0 = (i0 | (i0 << 4)) & 0x0F0F0F0F;
    i0 = (i0 | (i0 << 2)) & 0x33333333;
    i0 = (i0 | (i0 << 1)) & 0x55555555;

    i1 = (i1 | (i1 << 8)) & 0x00FF00FF;
    i1 = (i1 | (i1 << 4)) & 0x0F0F0F0F;
    i1 = (i1 | (i1 << 2)) & 0x33333333;
    i1 = (i1 | (i1 << 1)) & 0x55555555;

    return ((i1 << 1) | i0) >>> 0;
}