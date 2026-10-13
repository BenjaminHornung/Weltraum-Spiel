const CHANNEL_EPSILON = 1;
const MAX_CHANGED_FRACTION = 0.002;
const MAX_TILE_CHANGED_FRACTION = 0.005;
const GRID_COLUMNS = 8;
const GRID_ROWS = 8;
function failed(status, width = null, height = null, pixelCount = null) {
    return {
        pass: false,
        status,
        metrics: {
            width,
            height,
            pixelCount,
            changedPixels: null,
            changedFraction: null,
            meanAbsoluteChannelDelta: null,
            maxChannelDelta: null,
            channelEpsilon: CHANNEL_EPSILON,
            maxChangedFraction: MAX_CHANGED_FRACTION,
            maxTileChangedFraction: MAX_TILE_CHANGED_FRACTION,
            tileColumns: null,
            tileRows: null,
        },
        failedTiles: [],
    };
}
function isBlank(bytes, pixelCount) {
    let uniform = true;
    let transparent = true;
    const red = bytes[0];
    const green = bytes[1];
    const blue = bytes[2];
    const alpha = bytes[3];
    for (let pixel = 0; pixel < pixelCount; pixel++) {
        const offset = pixel * 4;
        if (bytes[offset] !== red || bytes[offset + 1] !== green || bytes[offset + 2] !== blue || bytes[offset + 3] !== alpha) {
            uniform = false;
        }
        if (bytes[offset + 3] !== 0)
            transparent = false;
        if (!uniform && !transparent)
            return false;
    }
    return uniform || transparent;
}
export function compareImages(a, b, width, height) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
        return failed('INVALID_DIMENSIONS');
    }
    const pixelCount = width * height;
    const byteLength = pixelCount * 4;
    if (!Number.isSafeInteger(pixelCount) || !Number.isSafeInteger(byteLength)) {
        return failed('INVALID_DIMENSIONS', width, height);
    }
    if (!(a instanceof Uint8Array || a instanceof Uint8ClampedArray)
        || !(b instanceof Uint8Array || b instanceof Uint8ClampedArray)) {
        return failed('INVALID_DATA', width, height, pixelCount);
    }
    if (a.length !== byteLength || b.length !== byteLength) {
        return failed('LENGTH_MISMATCH', width, height, pixelCount);
    }
    if (isBlank(a, pixelCount) || isBlank(b, pixelCount)) {
        return failed('BLANK_IMAGE', width, height, pixelCount);
    }
    const tileColumns = Math.min(GRID_COLUMNS, width);
    const tileRows = Math.min(GRID_ROWS, height);
    const tileChangedPixels = new Array(tileColumns * tileRows).fill(0);
    let changedPixels = 0;
    let totalChannelDelta = 0;
    let maxChannelDelta = 0;
    for (let y = 0; y < height; y++) {
        const tileY = Math.floor(y * tileRows / height);
        for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            let pixelChanged = false;
            for (let channel = 0; channel < 4; channel++) {
                const delta = Math.abs(a[offset + channel] - b[offset + channel]);
                totalChannelDelta += delta;
                if (delta > maxChannelDelta)
                    maxChannelDelta = delta;
                if (delta > CHANNEL_EPSILON)
                    pixelChanged = true;
            }
            if (pixelChanged) {
                changedPixels++;
                const tileX = Math.floor(x * tileColumns / width);
                tileChangedPixels[tileY * tileColumns + tileX]++;
            }
        }
    }
    const failedTiles = [];
    for (let row = 0; row < tileRows; row++) {
        const y = Math.floor(row * height / tileRows);
        const tileHeight = Math.floor((row + 1) * height / tileRows) - y;
        for (let column = 0; column < tileColumns; column++) {
            const x = Math.floor(column * width / tileColumns);
            const tileWidth = Math.floor((column + 1) * width / tileColumns) - x;
            const tilePixelCount = tileWidth * tileHeight;
            const tileChanged = tileChangedPixels[row * tileColumns + column];
            const changedFraction = tileChanged / tilePixelCount;
            if (changedFraction > MAX_TILE_CHANGED_FRACTION) {
                failedTiles.push({ column, row, x, y, width: tileWidth, height: tileHeight, changedPixels: tileChanged, changedFraction });
            }
        }
    }
    const changedFraction = changedPixels / pixelCount;
    const pass = changedFraction <= MAX_CHANGED_FRACTION && failedTiles.length === 0;
    return {
        pass,
        status: pass ? 'PASS' : 'DIFFERENT',
        metrics: {
            width,
            height,
            pixelCount,
            changedPixels,
            changedFraction,
            meanAbsoluteChannelDelta: totalChannelDelta / byteLength,
            maxChannelDelta,
            channelEpsilon: CHANNEL_EPSILON,
            maxChangedFraction: MAX_CHANGED_FRACTION,
            maxTileChangedFraction: MAX_TILE_CHANGED_FRACTION,
            tileColumns,
            tileRows,
        },
        failedTiles,
    };
}
