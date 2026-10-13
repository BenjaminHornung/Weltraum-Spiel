export function packBytes(bytes) {
    // A detached byte view must not masquerade as an empty payload.
    new DataView(bytes.buffer, bytes.byteOffset, 0);
    const words = new Uint32Array(Math.ceil(bytes.length / 4));
    for (let i = 0; i < bytes.length; i++) {
        words[Math.floor(i / 4)] |= bytes[i] << ((i % 4) * 8);
    }
    return words;
}
export function readByte(words, index) {
    new DataView(words.buffer, words.byteOffset, 0);
    if (!Number.isSafeInteger(index) || index < 0 || index >= words.length * 4) {
        throw new RangeError('byte index must be an integer within the word buffer');
    }
    return (words[Math.floor(index / 4)] >>> ((index % 4) * 8)) & 0xff;
}
export function alignedBytes(n, alignment) {
    if (!Number.isSafeInteger(n) || n < 0)
        throw new RangeError('byte count must be a safe non-negative integer');
    if (!Number.isSafeInteger(alignment) || alignment < 1 || !Number.isInteger(Math.log2(alignment))) {
        throw new RangeError('alignment must be a positive safe power of two');
    }
    const aligned = Math.ceil(n / alignment) * alignment;
    if (!Number.isSafeInteger(aligned))
        throw new RangeError('aligned byte count exceeds the safe integer range');
    return aligned;
}
function alignedBufferBytes(n, alignment) {
    if (!Number.isSafeInteger(n) || n < 0)
        throw new RangeError('buffer size must be a safe non-negative integer');
    return alignedBytes(Math.max(n, 4), alignment);
}
export function quoteResidency(input, alignment) {
    const perGenerationBytes = [
        input.payloadBytes,
        input.pageTableBytes,
        input.hierarchyBytes,
        input.metadataBytes,
    ].reduce((sum, size) => sum + alignedBufferBytes(size, alignment), 0);
    const oldNewGenerationsBytes = perGenerationBytes * 2;
    const historyBytes = alignedBytes(input.historyBytes, alignment);
    const peakBytes = oldNewGenerationsBytes + historyBytes;
    if (![perGenerationBytes, oldNewGenerationsBytes, historyBytes, peakBytes].every(Number.isSafeInteger)) {
        throw new RangeError('residency quote exceeds the safe integer range');
    }
    return Object.freeze({
        rawPayloadBytes: input.payloadBytes,
        perGenerationBytes,
        oldNewGenerationsBytes,
        historyBytes,
        peakBytes,
    });
}
