function defaultDecoder(data) {
    const td = new TextDecoder();
    const out = td.decode(data);
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