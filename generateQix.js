
const checkOverlap = (a, b) => {
    if (b[0] > a[2] || a[0] > b[2]) {
        return false;
    }
    if (b[1] > a[3] || a[1] > b[3]) {
        return false;
    }
    return true;
}
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
class QixNode {
    constructor(maxDepth, bbox, depth, splitSize = 2) {
        this.maxDepth = maxDepth;
        this.bbox = bbox;
        this.depth = depth;
        this.splitSize = splitSize;
        this.ids = [];
        this.idBbox = [];
        this.children = [];
        this.leaf = this.maxDepth === this.depth;
        this.length = null;
        this.totalLength = null;
        this.maxDepth;
    }
    intersects(bbox) {
        return checkOverlap(bbox, this.bbox);
    }
    serializeSelf(byteOrder, array, offset) {
        array.setUint32(offset, this.totalLength - 40, byteOrder);
        array.setFloat64(offset + 4, this.bbox[0], byteOrder);
        array.setFloat64(offset + 12, this.bbox[1], byteOrder);
        array.setFloat64(offset + 20, this.bbox[2], byteOrder);
        array.setFloat64(offset + 28, this.bbox[3], byteOrder);
        array.setUint32(offset + 36, this.ids.length, byteOrder);
        let i = 0;
        for (const id of this.ids) {
            array.setUint32(offset + 40 + (i * 4), id, byteOrder);
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
    tidyBbox() {
        const bbox = [Infinity, Infinity, -Infinity, -Infinity]
        for (const idBbox of this.idBbox) {
            updateBbox(bbox, idBbox)
        }
        if (this.children.length) {
            for (const child of this.children) {
                updateBbox(bbox, child.bbox);
            }
        }
        this.bbox = bbox;
        this.length = (44 + this.ids.length * 4);
        this.totalLength = this.length;
        this.maxDepth = this.depth;
        if (this.leaf) {
            return;
        }
        for (const child of this.children) {
            this.maxDepth = Math.max(this.maxDepth, child.maxDepth);
            this.totalLength += child.totalLength;
        }
    }
    tidy() {
        if (this.leaf) {
            if (!this.ids.length) {
                return { status: 'delete' }
            }
            if (this.ids.length === 1) {
                return {
                    status: 'single',
                    id: this.ids[0],
                    bbox: this.idBbox[0]
                }
            }
            this.tidyBbox();
            return {
                status: 'ok',
                node: this
            }
        }
        const newChildren = [];
        for (const child of this.children) {
            const updated = child.tidy();
            if (updated.status === 'delete') {
                continue;
            }
            if (updated.status === 'single') {
                this.ids.push(updated.id);
                this.idBbox.push(updated.bbox);
                continue;
            }
            if (updated.status === 'ok') {
                newChildren.push(updated.node)
                continue;
            }
            throw new Error('should not get here', updated);
        }
        if (!newChildren.length) {
            this.leaf = true;
            this.children = [];
            return this.tidy();
        }
        if (newChildren.length === 1) {
            const onlyChild = newChildren[0];
            if (!this.ids.length) {
                return {
                    status: 'ok',
                    node: onlyChild
                }
            }
            this.ids.push(...onlyChild.ids);
            this.idBbox.push(...onlyChild.idBbox)
            this.leaf = onlyChild.leaf;
            this.children = onlyChild.children;
            this.tidyBbox();
            return {
                status: 'ok',
                node: this
            }
        }
        this.children = newChildren;
        this.tidyBbox();
        return {
            status: 'ok',
            node: this
        }

    }
    insert(bbox, id) {
        if (this.leaf) {
            this.ids.push(id);
            this.idBbox.push(bbox);
            return;
        }
        let match = null;
        for (const child of this.children) {
            if (child.intersects(bbox)) {
                if (match) {
                    this.ids.push(id);
                    this.idBbox.push(bbox);
                    return;
                }
                match = child;
            }
        }
        if (!match) {
            // probably shouldn't get here
            this.ids.push(id);
            this.idBbox.push(bbox);
            return;
        }
        match.insert(bbox, id);
    }
    createChildren() {
        if (this.leaf) {
            return;
        }
        const xHeight = this.bbox[2] - this.bbox[0];
        const yHeight = this.bbox[3] - this.bbox[1];
        const childBoxes = [];
        if (this.splitSize === 2) {
            if (xHeight > yHeight) {
                const xMid = this.bbox[0] + (xHeight) / 2;
                childBoxes.push([this.bbox[0], this.bbox[1], xMid, this.bbox[3]]);
                childBoxes.push([xMid, this.bbox[1], this.bbox[2], this.bbox[3]]);
            } else {
                const yMid = this.bbox[1] + (yHeight) / 2;
                childBoxes.push([this.bbox[0], this.bbox[1], this.bbox[2], yMid]);
                childBoxes.push([this.bbox[0], yMid, this.bbox[2], this.bbox[3]]);
            }
        } else if (this.splitSize === 4) {
            const xMid = this.bbox[0] + (xHeight) / 2;
            const yMid = this.bbox[1] + (yHeight) / 2;
            childBoxes.push([this.bbox[0], this.bbox[1], xMid, yMid]);
            childBoxes.push([xMid, yMid, this.bbox[2], this.bbox[3]]);
            childBoxes.push([xMid, this.bbox[1], this.bbox[2], yMid]);
            childBoxes.push([this.bbox[0], yMid, xMid, this.bbox[3]]);
        }
        for (const bbox of childBoxes) {
            const child = new QixNode(this.maxDepth, bbox, this.depth + 1, this.splitSize);
            child.createChildren();
            this.children.push(child);
        }
    }
}

class Qix {
    constructor(splitSize = 2) {
        this.offset = 100;
        this.bbox = [Infinity, Infinity, -Infinity, -Infinity]
        this.rows = [];
        this.root = null;
        this.splitSize = splitSize;
        this.maxDepth = null;
    }
    updateBbox(bbox) {
        updateBbox(this.bbox, bbox);
    }
    calculateMaxDepth() {
        let maxDepth = 0;
        const numShapes = this.rows.length;
        let nodes = 1;

        while (nodes * 4 < numShapes) {
            maxDepth += 1;
            nodes *= 2;
        }
        this.maxDepth = maxDepth;
    }
    createTree() {
        if (this.maxDepth === 0) {
            throw new Error('bad depth');
        }
        this.root = new QixNode(this.maxDepth, this.bbox, 1, this.splitSize);
        this.root.createChildren();
        for (const { id, bbox } of this.rows) {
            this.root.insert(bbox, id);
        }
        const result = this.root.tidy();
        if (result.status === 'delete') {
            throw new Error('empty shapefile')
        }
        if (result.status === 'single') {
            throw new Error('does not work on shapefiles with only one row');
        }
        if (result.status === 'ok') {
            this.root = result.node;
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
        view.setUint32(8, this.rows.length, byteOrder);
        view.setUint32(12, this.root.maxDepth, byteOrder);
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

export default (data, splitSize) => {
    const qix = new Qix(splitSize);
    qix.injestShp(data);
    qix.calculateMaxDepth();
    qix.createTree();
    return qix.outputBinary();
}