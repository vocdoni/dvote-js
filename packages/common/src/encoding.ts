import { Buffer } from "buffer/"

export function hexStringToBuffer(hexString: string): Buffer {
    if (!/^(0x)?[0-9a-fA-F]+$/.test(hexString)) throw new Error("Invalid hex string")
    else if (hexString.length % 2 != 0) throw new Error("The hex string contains an odd length")

    return Buffer.from(strip0x(hexString), "hex")
}
export function uintArrayToHex(buff: Uint8Array, prepend0x?: boolean): string {
    const bytes: string[] = []
    for (let byte of buff) {
        if (byte >= 16) bytes.push(byte.toString(16))
        else bytes.push("0" + byte.toString(16))
    }
    if (prepend0x) return "0x" + bytes.join("")
    return bytes.join("")
}

/** Encodes the given big integer as a 32 byte big endian buffer */
export function bigIntToBuffer(number: bigint): Buffer {
    let hexNumber = number.toString(16)
    while (hexNumber.length < 64) hexNumber = "0" + hexNumber
    return Buffer.from(hexNumber, "hex")
}

/** Encodes the given big integer as a 32 byte little endian buffer */
export function bigIntToLeBuffer(number: bigint): Buffer {
    return bigIntToBuffer(number).reverse()
}

export function bufferToBigInt(bytes: Buffer | Uint8Array): bigint {
    // Ensure that it is a buffer
    bytes = Buffer.from(bytes)
    return BigInt(ensure0x(bytes.toString("hex")))
}

export function bufferLeToBigInt(bytes: Buffer | Uint8Array): bigint {
    bytes = Buffer.from(bytes)
    return bufferToBigInt(bytes.reverse())
}

export function ensure0x(value: string): string {
    return value.startsWith("0x") ? value : "0x" + value
}

export function strip0x(value: string): string {
    return value.startsWith("0x") ? value.substring(2) : value
}
