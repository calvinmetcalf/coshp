import checkOverlap from './checkOverlap.js';
import { consolidateIds } from './consolidate-ids.js';
const DEFAULT_ID_FETCH = 8;
import { BlockReader } from './blockReader.js'

class QixNode {
    constructor(height, parent, order) {
        this.height = height;
        this.ready = false;
        this.children = [];
        this.ids = [];
        if (height > 0) {
            this.parent = parent;
            this.order = order;
            this.root = false;
            this.endian = this.parent.endian;
            this.buffer = this.parent.buffer;
            this.path = `${this.parent.path}${this.order}`
        } else {
            this.root = true;
            this.path = '0';
            this.buffer = parent;
            this.offset = 16;
            this.eager = order;
        }
    }
    toString() {
        return JSON.stringify({
            root: this.root,
            height: this.height,
            ids: this.ids,
            order: this.order,
            endian: this.endian,
            numChildren: this.numChildren,
            numShapes: this.numShapes,
            nextSib: this.nextSib,
            bbox: this.bbox,
            firstChild: this.firstChild,
            nextSib: this.nextSib,
            offset: this.offset,
            path: this.path
        }, false, 2)
    }
    toJSON() {
        return this.toString();
    }
    async init() {
        if (this.ready) {
            return true;
        }
        if (this.readyProm) {
            return this.readyProm
        }
        // console.log(this)
        this.readyProm = this.#nodeInit().then(() => {
            this.readyProm = null
        });
        return this.readyProm;
    }

    async #nodeInit() {
        if (this.root) {
            this.endian = await this.buffer.getUint8(3) !== 2;
        } else {
            if (this.order === 0) {
                this.offset = this.parent.firstChild;
            } else {
                const sib = await this.#getSib();
                if (!sib) {
                    throw new Error('no sibling');
                }
                this.offset = sib.nextSib + sib.offset + 44 + sib.numShapes * 4;
            }
        }
        this.nextSib = await this.buffer.getUint32(this.offset, this.endian);
        this.bbox = [
            await this.buffer.getFloat64(this.offset + 4, this.endian),
            await this.buffer.getFloat64(this.offset + 12, this.endian),
            await this.buffer.getFloat64(this.offset + 20, this.endian),
            await this.buffer.getFloat64(this.offset + 28, this.endian),
        ]
        this.numShapes = await this.buffer.getUint32(this.offset + 36, this.endian);
        if (this.numShapes > 10000) {
            throw new Error('too many ids');
        }
        let i = -1;
        while (++i < this.numShapes) {
            this.ids.push(await this.buffer.getUint32(this.offset + 40 + i * 4, this.endian));
        }
        this.numChildren = await this.buffer.getUint32(this.offset + 40 + i * 4, this.endian);

        i = 0;
        if (this.numChildren > 100000) {
            console.log(this.toString())
            throw new Error('bad')
        }
        while (i < this.numChildren) {
            this.children.push(new QixNode(this.height + 1, this, i));
            i++;
        }
        this.firstChild = this.offset + 44 + 4 * this.numShapes;
        // console.log(this.toString())
        this.ready = true;

    }
    async #getSib() {
        if (this.root || this.order === 0) {
            return null;
        }
        const sib = this.parent.children[this.order - 1];
        if (!sib.ready) {
            await sib.init();
        }
        return sib;
    }
    async query(bbox) {
        if (!this.ready) {
            await this.init();
        }

        if (!checkOverlap(bbox, this.bbox)) {
            return false;
        }
        return {
            children: this.children.toReversed(),
            ids: this.ids
        }
    }
}

export class QixBlockReader {
    constructor(reader, blocksize, gap) {
        this.tree = new QixNode(0, new BlockReader(reader, 'qix', blocksize));
        this.gap = gap;
    }
    async query(bbox) {
        const output = [];
        const todo = [this.tree];
        while (todo.length) {
            const item = todo.pop();
            const result = await item.query(bbox);
            if (!result) {
                continue;
            }
            const { ids, children } = result;
            if (ids.length) {
                output.push(...ids);
            }
            if (children.length) {
                todo.push(...children);
            }
        }
        if (!output.length) {
            return [];
        }
        return consolidateIds(output, this.gap)
    }
    async init() {
        await this.tree.init();
    }
}