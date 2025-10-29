/*
* Based upon https://github.com/mourner/flatbush/blob/5729a98facd94a66038b7772906f78cd22249336/index.js (ISC Vladimir Agafonkin)
*/
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
const bboxArea = (bbox) => (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
const calcBbox = (arr) => {
    const bbox =  [Infinity, Infinity, -Infinity, -Infinity];
    for (const item of arr) {
        updateBbox(bbox, item.bbox);
    }
    return bbox;
}
const calcSwap = (left, right) => {
    const leftArea = bboxArea(left.bbox);
    const rightArea = bboxArea(right.bbox);
    const leftBboxShiftDown = [...left.bbox];
    updateBbox(leftBboxShiftDown, right.ids[0].bbox);
    const rightBboxShiftDown = calcBbox(right.ids.slice(1))
    const leftBboxShiftUp = calcBbox(left.ids.slice(0, -1));
    const rightBboxShiftUp =  [...right.bbox];
    updateBbox(rightBboxShiftUp, left.ids[left.ids.length - 1].bbox);
    const downAreaChange = (bboxArea(leftBboxShiftDown) - leftArea) +  (bboxArea(rightBboxShiftDown) - rightArea);
    const upAreaChange = (bboxArea(leftBboxShiftUp) - leftArea) +  (bboxArea(rightBboxShiftUp) - rightArea);
    return [downAreaChange, upAreaChange]
}
const maybeSwap = arr=> {
    let i = 0
    while (++i < arr.length) {
        const left = arr[i-1];
        const right =  arr[i]
        const [down, up] = calcSwap(left, right);
        let swap = false;
        if (down <= up && down < 0) {
            swap = 'down'
        } else if (up < 0) {
            swap = 'up'
        }
        if (swap === 'down') {
            const id = right.ids.shift();
            left.ids.push(id)
            updateBbox(left.bbox, id.bbox);
            right.bbox = calcBbox(right.ids);
            left.length += 4;
            left.totalLength += 4;
            right.length -= 4;
            right.totalLength -= 4;
        } else if (swap === 'up') {
            const id = left.ids.pop()
            right.ids.unshift(id)
            updateBbox(right.bbox, id.bbox);
            left.bbox = calcBbox(left.ids);
            right.length += 4;
            right.totalLength += 4;
            left.length -= 4;
            left.totalLength -= 4;
        }

    }
}
class QixNode {
    constructor(ids, children = []) {
        this.ids = ids
        this.children = children
        this.calcBbox()
        this.leaf = !this.children.length;
        this.height = 1;
        if (!this.leaf) {
            for (const child of this.children) {
                this.height = Math.max(this.height, child.height);
    
            }
            this.height++;
        }
    }
    intersects(bbox) {
        return checkOverlap(bbox, this.bbox);
    }
    calcBbox(deep) {
        this.bbox = [Infinity, Infinity, -Infinity, -Infinity]
        for (const id of this.ids) {
            updateBbox(this.bbox, id.bbox);
        }
       for (const child of this.children) {
        if (deep) {
            child.calcBbox(deep);
        }
         updateBbox(this.bbox, child.bbox);
       }
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
        array.setUint32(offset, this.totalLength() - 44 - this.ids.length * 4, byteOrder);
        array.setFloat64(offset + 4, this.bbox[0], byteOrder);
        array.setFloat64(offset + 12, this.bbox[1], byteOrder);
        array.setFloat64(offset + 20, this.bbox[2], byteOrder);
        array.setFloat64(offset + 28, this.bbox[3], byteOrder);
        array.setUint32(offset + 36, this.ids.length, byteOrder);
        let i = 0;
        for (const id of this.ids) {
            array.setUint32(offset + 40 + (i * 4), id.id - 1, byteOrder);
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
    mapybePromote() {
       const newIds = [];
       for (const child of this.children) {
        if (!child.ids.length) {
            continue;
        }
        const childArea = bboxArea(child.bbox);
        const target = childArea * 0.6;
        const ids = [];
       for (const id of child.ids) {
            if (bboxArea(id.bbox) >= target) {
                newIds.push(id);
            } else {
                ids.push(id)
            }
       }
       child.ids = ids;
       child.calcBbox();
      }
      if (newIds.length) {
        this.ids = this.ids.concat(newIds);
      }
    }
}

class Qix {
    constructor(nodeSize = 4, leafSize = 8, opts={}) {
        this.offset = 100;
        this.bbox = [Infinity, Infinity, -Infinity, -Infinity]
        this.rows = [];
        this.root = null;
        this.nodeSize = nodeSize;
        this.leafSize = leafSize;
        this.maxDepth = null;
        this.swap = opts.swap;
        this.promote = opts.promote;
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
        if (this.swap) {
          maybeSwap(treeRow)
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
               
                const node = new QixNode([], item);
                treeRow.push(node);
                if (this.promote) {
                  node.mapybePromote();
                }
            }
           
        }
        if (treeRow.length === 1) {
            this.root = treeRow[0];
        } else {
            this.root = new QixNode([], treeRow);
        }

    }
    outputBinary(byteOrder = false) {
        const length = 16 + this.root.totalLength();
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
export default (data, nodeSize, leafSize, opts={}) => {
    const qix = new Qix(nodeSize, leafSize, opts);
    qix.injestShp(data);
    qix.createTree();
    return qix.outputBinary();
}


