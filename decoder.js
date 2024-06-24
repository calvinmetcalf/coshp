function defaultDecoder(data) {
    var decoder = new StringDecoder();
    var out = decoder.write(data) + decoder.end();
    return out.replace(/\0/g, '').trim();
}
export default function createDecoder(encoding) {
    if (!encoding) {
        return defaultDecoder;
    }

    return decoder;
    function decoder(buffer) {
        const td = new TextDecoder(encoding);
        return td.decode(buffer);
    }
}