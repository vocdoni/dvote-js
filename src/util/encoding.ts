import { Buffer } from "buffer/"

const BI_ZERO = BigInt("0")
const BI_256 = BigInt("256")

export function hexStringToBuffer(hexString: string): Buffer {
    if (!/^(0x)?[0-9a-fA-F]+$/.test(hexString)) throw new Error("Invalid hex string")
    else if (hexString.length % 2 != 0) throw new Error("The hex string contains an odd length")
    hexString = hexString.replace(/^0x/, "")

    const result = new Buffer(hexString.length / 2)
    for (let i = 0; i < result.length; i++) {
        result[i] = parseInt(hexString.substr(i * 2, 2), 16)
    }
    return result
}

export function bigIntToBuffer(number: bigint): Buffer {
    const resultBytes: number[] = []

    do {
        const byte = number % BI_256
        number /= BI_256
        resultBytes.unshift(Number(byte))
    }
    while (number > BI_ZERO)

    return Buffer.from(resultBytes)
}

export function bufferToBigInt(bytes: Buffer): bigint {
    return BigInt("0x" + bytes.toString("hex"))
}
