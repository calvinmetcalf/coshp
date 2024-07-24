

const parse = (data, offset, lilendian) => {
    const out = {};
    out.fileStartOffset = offset;
    out.nextSiblingOffset = data.getUint32(offset + 0, lilendian);
    out.bbox = [
        data.getFloat64(offset + 4, lilendian),
        data.getFloat64(offset + 12, lilendian),
        data.getFloat64(offset + 20, lilendian),
        data.getFloat64(offset + 28, lilendian),
    ]
    out.numShapes = data.getUint32(offset + 36, lilendian);

    let i = 0;
    out.ids = [];
    while (i < out.numShapes) {
        out.ids.push(data.getUint32(offset + 40 + i * 4, lilendian));
        i++;
    }
    out.children = data.getUint32(offset + 40 + i * 4, lilendian)
    out.length = (44 + i * 4)
    out.childNodes = [];
    return out;
}

const makeTree = rows => {
    let i = 1;
    let root = rows[0]
    let parent = root;
    root.depth = 1;
    root.id = 0;
    const stack = [];
    while (i < rows.length) {
        let current = rows[i];
        current.id = i;
        parent.childNodes.push(current);
        current.depth = stack.length + 2;
        if (current.children > 0) {
            stack.push(parent);
            parent = current;
        } else {
            while (parent.childNodes.length >= parent.children) {
                if (stack.length) {
                    parent = stack.pop()
                } else {
                    break;
                }
            }
        }
        i++;
    }
    return root;
}

export const parseData = data => {
    let offset = 16;
    const endian = data.getUint8(3);
    const rows = [];
    while (offset < data.byteLength) {
        const out = parse(data, offset, endian !== 2);
        offset += out.length;
        rows.push(out);
    }
    return rows;
}

export const parseQix = (data) => {
    const out = parseData(data);
    const tree = makeTree(out);
    return tree;
}

export const checkOverlap = (a, b) => {
    if (b[0] > a[2] || a[0] > b[2]) {
        return false;
    }
    if (b[1] > a[3] || a[1] > b[3]) {
        return false;
    }
    return true;
}
export const queryQix = (tree, bbox) => {
    const ids = [];
    const toCheck = [tree];
    while (toCheck.length) {
        const node = toCheck.pop();
        if (!checkOverlap(node.bbox, bbox)) {
            continue;
        }
        if (node.numShapes) {
            ids.push(...node.ids)
        }
        if (node.children) {
            toCheck.push(...node.childNodes);
        }
    }
    return ids;
}

export const consolidateIds = (ids) => {
    ids.sort((a, b) => a - b);
    const out = [];
    let prev;
    let i = -1;
    while (++i < ids.length) {
        const cur = ids[i];
        if (!prev) {
            prev = {
                type: 'single',
                id: cur
            }
            continue;
        }
        if (prev.type === 'single') {
            if (prev.id + 1 === cur) {
                prev = {
                    type: 'range',
                    start: prev.id,
                    end: cur
                }
            } else {
                out.push(prev);
                prev = {
                    type: 'single',
                    id: cur
                }
            }
            continue;
        }
        if (prev.type === 'range') {
            if (prev.end + 1 === cur) {
                prev.end = cur;
            } else {
                out.push(prev);
                prev = {
                    type: 'single',
                    id: cur
                }
            }
        }
    }
    out.push(prev);
    return out;
}
export class EagerQix {
    constructor(reader) {
        this.reader = reader;
    }
    init() {
        const data = this.reader.readAll('qix', true);
        this.tree = parseQix(data);
    }
    query(bbox) {
        const ids = queryQix(tree, bbox);
        return consolidateIds(ids);
    }
}