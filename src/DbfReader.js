import createDecoder from './decoder.js';

export default class DbfReader {
    constructor(encoding) {
        this.decoder = createDecoder(encoding);
        this.header = null;
        this.rowHeaders = null;
    }
    parseHeaders(data) {
        this.header = {};
        this.header.lastUpdated = new Date(data.getUint8(1) + 1900, data.getUint8(2), data.getUint8(3));
        this.header.records = data.getUint32(4, true);
        this.header.headerLen = data.getUint16(8, true);
        this.header.recLen = data.getUint16(10, true);
        return this.header.headerLen;
    }
    parseRowHeaders(data) {
        this.rowHeaders = [];
        let offset = 0;
        const headerLen = data.byteLength;
        while (offset < headerLen) {
            this.rowHeaders.push({
                name: this.decoder(new Uint8Array(data.buffer.slice(offset, offset + 11))),
                dataType: String.fromCharCode(data.getUint8(offset + 11)),
                len: data.getUint8(offset + 16),
                decimal: data.getUint8(offset + 17)
            });
            if (data.getUint8(offset + 32) === 13) {
                break;
            } else {
                offset += 32;
            }
        }
    }
    getOffset(id) {
        const baseoffset = ((this.rowHeaders.length + 1) << 5) + 2;
        const len = this.header.recLen;
        const offset = baseoffset + (id - 1) * len;
        return { offset, len }
    }
    parseRow(buffer, offset = 0) {
        var out = {};
        var i = 0;
        var len = this.rowHeaders.length;
        while (i < len) {
            const header = this.rowHeaders[i];
            const field = this.rowFuncs(buffer, offset, header.len, header.dataType);
            offset += header.len;
            if (header.name.indexOf('\x00') > -1) {
                header.name = header.name.slice(0, header.name.indexOf('\x00'))
            }
            if (typeof field !== 'undefined') {
                out[header.name] = field;
            }
            i++;
        }
        return out;
    }
    rowFuncs(buffer, offset, len, type) {
        const data = new Uint8Array(buffer.buffer.slice(offset, offset + len));
        const textData = this.decoder(data);
        switch (type) {
            case 'N':
            case 'F':
            case 'O':
                return parseFloat(textData, 10);
            case 'D':
                return new Date(textData.slice(0, 4), parseInt(textData.slice(4, 6), 10) - 1, textData.slice(6, 8));
            case 'L':
                return textData.toLowerCase() === 'y' || textData.toLowerCase() === 't';
            default:
                return textData;
        }
    }
}