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
class QixNode {
    constructor(ids, children = []) {
        this.ids = [];
        this.idBbox = [];
        this.bbox = [Infinity, Infinity, -Infinity, -Infinity]
        for (const id of ids) {
            this.ids.push(id.id);
            this.idBbox.push(id.bbox);
            updateBbox(this.bbox, id.bbox);
        }
        this.children = children
        this.leaf = !this.children.length;
        this.length = (44 + this.ids.length * 4);
        this.totalLength = this.length;
        this.height = 1;

        if (!this.leaf) {
            for (const child of this.children) {
                this.height = Math.max(this.height, child.height);
                this.totalLength += child.totalLength;
                updateBbox(this.bbox, child.bbox);
            }
            this.height++;
        }
    }
    intersects(bbox) {
        return checkOverlap(bbox, this.bbox);
    }
    serializeSelf(byteOrder, array, offset) {
        array.setUint32(offset, this.totalLength - 44 - this.ids.length * 4, byteOrder);
        array.setFloat64(offset + 4, this.bbox[0], byteOrder);
        array.setFloat64(offset + 12, this.bbox[1], byteOrder);
        array.setFloat64(offset + 20, this.bbox[2], byteOrder);
        array.setFloat64(offset + 28, this.bbox[3], byteOrder);
        array.setUint32(offset + 36, this.ids.length, byteOrder);
        let i = 0;
        for (const id of this.ids) {
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
        let newOffset = offset + this.length;
        for (const child of this.children) {
            child.serialize(byteOrder, array, newOffset);
            newOffset += child.totalLength;

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
        const width = (this.bbox[2] - this.bbox[0]) || 1;
        const height = (this.bbox[3] - this.bbox[1]) || 1;
        const hilbertMax = (1 << 16) - 1;

        this.rows.forEach(row => {
            const x = Math.floor(hilbertMax * ((row.bbox[0] + row.bbox[2]) / 2 - this.bbox[0]) / width);
            const y = Math.floor(hilbertMax * ((row.bbox[1] + row.bbox[3]) / 2 - this.bbox[1]) / height);
            row.hilbert = hilbert(x, y);
        });
        this.rows.sort((a, b) =>
            a.hilbert - b.hilbert
        );
        let treeRow = [];
        const arrayChunks = chunk(this.rows.length, this.leafSize);
        let i = 0;
        for (const chunkSize of arrayChunks) {
            let target = i + chunkSize;
            let item = [];
            while (i < target) {
                item.push(this.rows[i++])
            }
            treeRow.push(new QixNode(item));
        }
        while (treeRow.length > this.nodeSize) {
            const prevRow = treeRow;
            treeRow = [];
            const arrayChunks = chunk(prevRow.length, this.nodeSize);
            let i = 0;
            for (const chunkSize of arrayChunks) {
                let target = i + chunkSize;
                let item = [];
                while (i < target) {
                    item.push(prevRow[i++])
                }
                treeRow.push(new QixNode([], item));
            }
        }
        if (treeRow.length === 1) {
            this.root = treeRow[0];
        } else {
            this.root = new QixNode([], treeRow);
        }

    }
    outputBinary(byteOrder = false) {
        const length = 16 + this.root.totalLength;
        const arr = new ArrayBuffer(length);
        const view = new DataView(arr);
        view.setUint8(0, 83); 'S';
        view.setUint8(1, 81); 'Q';
        view.setUint8(2, 84); 'T';
        const byteOrdermark = byteOrder ? 1 : 2;
        view.setUint8(3, byteOrdermark);
        view.setUint8(4, 1);
        view.setUint32(8, this.rows.length, byteOrder);
        view.setUint32(12, this.root.height, byteOrder);
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