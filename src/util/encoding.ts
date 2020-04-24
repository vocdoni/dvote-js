import { Buffer } from "buffer/"
// import * from "../util/hashing"
// const { Buffer } = require("buffer/")

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
