import checkOverlap from './checkOverlap.js';
import { consolidateIds } from './consolidate-ids.js';
const DEFAULT_ID_FETCH = 8;


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
            this.buffer = this.parent.buffer;
            this.endian = this.parent.endian;
        } else {
            this.root = true;
            this.buffer = parent;
            this.offset = 16;
        }
    }
    async getSlice(start, length) {
        return this.buffer.read('qix', start, length)
    }
    async init() {
        if (this.ready) {
            return true;
        }
        if (this.readyProm) {
            return this.readyProm
        }
        if (this.root) {
            this.readyProm = this.#rootInit();
        } else {
            this.readyProm = this.#nonRootInit();
        }
        this.readyProm.then(() => {
            this.readyProm = null
            this.ready = true;
        });
        return this.readyProm;
    }
    async #rootInit() {
        const view = await this.getSlice(0, 60);
        this.endian = view.getUint8(3) !== 2;
        const offset = 16;
        this.nextSib = view.getUint32(offset + 0, this.endian);
        this.bbox = [
            view.getFloat64(offset + 4, this.endian),
            view.getFloat64(offset + 12, this.endian),
            view.getFloat64(offset + 20, this.endian),
            view.getFloat64(offset + 28, this.endian),
        ]
        this.numShapes = view.getUint32(offset + 36, this.endian);
        if (this.numShapes === 0) {
            this.numChildren = view.getUint32(offset + 40, this.endian);
        } else {
            this.ids.push(view.getUint32(offset + 40, this.endian));
            const view2 = await this.getSlice(64, 4 * this.numShapes);
            let i = 0;
            while (i < this.numChildren) {
                const item = view2.getUint32(i * 4, this.endian);
                i++
                if (i + 1 === this.numChildren) {
                    this.numChildren = item;
                    break;
                }
                this.ids.push(item);
            }
        }
        let i = 0;
        while (i < this.numChildren) {
            this.children.push(new QixNode(this.height + 1, this, i));
            i++;
        }
        this.firstChild = 16 + 44 + 4 * this.numShapes;
    }

    async #nonRootInit() {
        if (this.order === 0) {
            this.offset = this.parent.firstChild;
        } else {
            const sib = await this.#getSib();
            if (!sib) {
                throw new Error('no sibling');
            }
            this.offset = sib.nextSib + sib.offset + 40;
        }
        const view = await this.#getView();
        this.nextSib = view.getUint32(0, this.endian);
        this.bbox = [
            view.getFloat64(4, this.endian),
            view.getFloat64(12, this.endian),
            view.getFloat64(20, this.endian),
            view.getFloat64(28, this.endian),
        ]
        this.numShapes = view.getUint32(36, this.endian);
        if (this.numShapes <= DEFAULT_ID_FETCH) {
            let i = -1;
            while (++i < this.numShapes) {
                this.ids.push(view.getUint32(40 + i * 4, this.endian));
            }
            this.numChildren = view.getUint32(40 + i * 4, this.endian);
        } else {
            let i = -1;
            while (++i <= 8) {
                this.ids.push(view.getUint32(40 + i * 4, this.endian));
            }
            const overflow = this.numShapes - 8;
            const view2 = await this.getSlice(this.offset + 44 + DEFAULT_ID_FETCH * 4, overflow * 4);
            i = -1;
            while (++i < overflow) {
                this.ids.push(view2.getUint32(i * 4, this.endian));
            }
            this.numChildren = this.ids.pop();
        }
        let i = 0;
        if (this.numChildren > 100000) {
            throw new Error('bad')
        }
        while (i < this.numChildren) {
            this.children.push(new QixNode(this.height + 1, this, i));
            i++;
        }
        this.firstChild = this.offset + 44 + 4 * this.numShapes;
        this.#handleOverFlow(view);
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
    #handleOverFlow(view) {
        if (this.numShapes >= DEFAULT_ID_FETCH) {
            return;
        }
        if (this.numChildren === 0 && this.order + 1 === this.parent.numChildren) {
            // we don't have any children and we don't have any younger siblings so it's too complicated to bother
            return;
        }
        const overflow = (DEFAULT_ID_FETCH - this.numShapes) * 4;
        const overFlowView = new DataView(view.buffer, view.byteOffset + view.byteLength - overflow, overflow);
        if (this.numChildren > 0) {
            this.children[0].setOverFlow(overFlowView);
            return;
        }
        const youngerSib = this.parent.children[this.order + 1];
        if (!youngerSib) {
            // should have cought this honestly;
            return;
        }
        youngerSib.setOverFlow(overFlowView);
    }
    setOverFlow(view) {
        if (this.ready || this.readyProm) {
            return;
        }
        this.overflow = view;
    }
    async #getView() {
        if (!this.overflow) {
            return this.getSlice(this.offset, 44 + DEFAULT_ID_FETCH * 4);
        }
        const finalBuffer = new ArrayBuffer(44 + DEFAULT_ID_FETCH * 4);
        const uint = new Uint8Array(finalBuffer);
        const overflow = new Uint8Array(this.overflow.buffer, this.overflow.byteOffset, this.overflow.byteLength);
        let i = -1;
        while (++i < overflow.byteLength) {
            uint[i] = overflow[i]
        }
        const otherSliceView = await this.getSlice(this.offset + overflow.byteLength, (44 + DEFAULT_ID_FETCH * 4) - overflow.byteLength);
        const otherSlice = new Uint8Array(otherSliceView.buffer, otherSliceView.byteOffset, otherSliceView.byteLength);
        i = -1;
        while (++i < otherSlice.byteLength) {
            uint[i + overflow.byteLength] = otherSlice[i]
        }
        return new DataView(finalBuffer);

    }
}

export class QixReader {
    constructor(reader) {
        this.tree = new QixNode(0, reader);
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
        return consolidateIds(output)
    }
}