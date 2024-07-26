

export class BlockReader {
    constructor(reader, ext, blocksize = 4 * 1024) {
        this.reader = reader;
        this.ext = ext;
        this.blocksize = blocksize;
        this.blocks = [];
        this.blockProms = new Map();
        const scratchArray = new ArrayBuffer(8);
        this.scratchUint8 = new Uint8Array(scratchArray);
        this.scratchView = new DataView(scratchArray);
    }
    #getBlockNumber(offset) {
        const block = Math.floor(offset / this.blocksize);
        return block;
    }
    async #fetchBlock(block) {
        const start = block * this.blocksize;
        const length = this.blocksize;
        return this.reader.read(this.ext, start, length);
    }
    async getBlock(offset) {
        const block = this.#getBlockNumber(offset);
        if (this.blocks[block]) {
            return this.blocks[block];
        }
        if (this.blockProms.has(block)) {
            return this.blockProms.get(block);
        }
        const blockProm = this.#fetchBlock(block);
        blockProm.then(item => {
            this.blocks[block] = item;
            this.blockProms.delete(block);
        });
        this.blockProms.set(block, blockProm);
        return blockProm;
    }
    async getUint8(offset) {
        const block = await this.getBlock(offset);
        const blockOffset = offset % this.blocksize;
        return block.getUint8(blockOffset);

    }
    async getUint32(offset, endian) {
        const length = 4;
        const block = await this.getBlock(offset);
        const blockOffset = offset % this.blocksize;
        if (blockOffset + length > this.blocksize) {
            console.log('split32')
            const otherBlock = await this.getBlock(blockOffset + length);
            const overhang = (blockOffset + length) % this.blocksize;
            let a, b, c, d;
            switch (overhang) {
                case 1:
                    a = block.getUint8(blockOffset);
                    b = block.getUint8(blockOffset + 1);
                    c = block.getUint8(blockOffset + 2);
                    d = otherBlock.getUint8(0);
                    break;
                case 2:
                    a = block.getUint8(blockOffset);
                    b = block.getUint8(blockOffset + 1);
                    c = otherBlock.getUint8(0);
                    d = otherBlock.getUint8(1);
                    break;
                case 3:
                    a = block.getUint8(blockOffset);
                    b = otherBlock.getUint8(0);
                    c = otherBlock.getUint8(1);
                    d = otherBlock.getUint8(2);
                    break;
            }
            if (endian) {
                [a, b, c, d] = [d, c, b, a];
            }
            return d + c << 1 + b << 2 + a << 3;
        }
        return block.getUint32(blockOffset, endian);
    }
    async getFloat64(offset, endian) {
        const length = 8;
        const block = await this.getBlock(offset);
        const blockOffset = offset % this.blocksize;
        if (blockOffset + length > this.blocksize) {
            const otherBlock = await this.getBlock(blockOffset + length);
            const overhang = (blockOffset + length) % this.blocksize;
            let i = -1;
            while (++i < length - overhang) {
                this.scratchUint8[i] = block.getUint8(blockOffset + i);
            }
            let j = -1;
            while (++j < overhang) {
                this.scratchUint8[i] = otherBlock.getUint8(j);
                i++;
            }
            return this.scratchView.getFloat64(0, endian);

        }
        return block.getFloat64(blockOffset, endian);
    }
}