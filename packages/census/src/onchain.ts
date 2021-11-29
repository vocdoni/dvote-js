import { bufferLeToBigInt } from "@vocdoni/common"

export namespace CensusOnChain {
    const HASH_FUNCTION_LEN = 32

    export function unpackSiblings(siblings: Uint8Array): bigint[] {
        if (siblings.length < 4) throw new Error("Invalid siblings buffer")

        const fullLen = Number(bufferLeToBigInt(siblings.slice(0, 2)))
        if (siblings.length != fullLen) throw new Error("The expected length doesn't match the siblings size")

        const result: bigint[] = []

        const bitmapBytesLength = Number(bufferLeToBigInt(siblings.slice(2, 4)))
        const bitmapBytes = siblings.slice(4, 4 + bitmapBytesLength)
        const bitmap = bytesToBitmap(bitmapBytes)

        const siblingsBytes = siblings.slice(4 + bitmapBytesLength)
        const emptySibling = BigInt("0")

        let siblingIdx = 0
        for (let i = 0; i < bitmap.length; i++) {
            if (siblingIdx >= siblingsBytes.length) break
            else if (bitmap[i]) {
                const v = siblingsBytes.slice(siblingIdx, siblingIdx + HASH_FUNCTION_LEN)
                result.push(bufferLeToBigInt(v))
                siblingIdx += HASH_FUNCTION_LEN
            }
            else {
                result.push(emptySibling)
            }
        }
        return result
    }

    function bytesToBitmap(bytes: Uint8Array): boolean[] {
        const result: boolean[] = []
        for (let i = 0; i < bytes.length; i++) {
            for (let j = 0; j < 8; j++) {
                result.push(!!(bytes[i] & (1 << j)))
            }
        }
        return result
    }
}
