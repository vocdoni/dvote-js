import { toUtf8Bytes } from "@ethersproject/strings"
import { keccak256 } from "@ethersproject/keccak256"
import { arrayify } from "@ethersproject/bytes"
import { strip0x, ensure0x } from "@vocdoni/common"

/**
 * Returns `false` if the passphrase is shorter than 8 characters, or it doesn't contain
 * at least one digit, one lowercase character and an uppercase one
 * @param passphrase
 */
export function isStrongPassphrase(passphrase: string): boolean {
    if (passphrase.length < 8) return false
    else if (!passphrase.match(/[a-z]+/)) return false
    else if (!passphrase.match(/[A-Z]+/)) return false
    else if (!passphrase.match(/[0-9]+/)) return false
    return true
}

/**
 * Generates a deterministic 32 byte payload from the given UTF8 passphrase and the given hexadecimal seed.
 * @param passphrase A UTF8 string
 * @param hexSeed A 32 byte hex string with the leading '0x'
 * @param rounds Number of hashing rounds to apply to the resulting payload (default: 10)
 */
export function digestSeededPassphrase(passphrase: string, hexSeed: string, rounds: number = 10): string {
    if (typeof passphrase != "string" || typeof hexSeed != "string") throw new Error("Invalid parameters")

    hexSeed = strip0x(hexSeed)
    if (hexSeed.length != 64) throw new Error("The hashed passphrase should be 64 characters long instead of " + hexSeed.length)

    // Conver the passphrase into UTF8 bytes and hash them
    const passphraseBytes = toUtf8Bytes(passphrase)
    const passphraseBytesHashed = strip0x(keccak256(passphraseBytes))

    if (passphraseBytesHashed.length != 64)
        throw new Error("Internal error: The hashed passphrase should be 64 characters long instead of " + passphraseBytesHashed.length)

    // Concatenating the bytes of the hashed passphrase + the seed's
    const sourceBytes = arrayify(ensure0x(passphraseBytesHashed + hexSeed))
    if (sourceBytes.length != 64)
        throw new Error("Internal error: The sourceBytes array should be 64 bytes long instead of " + sourceBytes.length)

    let result: string

    // Perform N rounds of keccak256
    for (let i = 0; i < rounds; i++) {
        if (typeof result == "undefined") result = keccak256(sourceBytes)
        else result = keccak256(result)
    }

    return result
}
