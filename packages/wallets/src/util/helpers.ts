import { utils } from "ethers"

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

    if (hexSeed.startsWith("0x")) hexSeed = hexSeed.substr(2)
    if (hexSeed.length != 64) throw new Error("The hashed passphrase should be 64 characters long instead of " + hexSeed.length)

    // Conver the passphrase into UTF8 bytes and hash them
    const passphraseBytes = utils.toUtf8Bytes(passphrase)
    const passphraseBytesHashed = utils.keccak256(passphraseBytes).substr(2) // skip 0x

    if (passphraseBytesHashed.length != 64)
        throw new Error("Internal error: The hashed passphrase should be 64 characters long instead of " + passphraseBytesHashed.length)

    // Concatenating the bytes of the hashed passphrase + the seed's
    const sourceBytes = utils.arrayify("0x" + passphraseBytesHashed + hexSeed)
    if (sourceBytes.length != 64)
        throw new Error("Internal error: The sourceBytes array should be 64 bytes long instead of " + sourceBytes.length)

    let result: string

    // Perform N rounds of keccak256
    for (let i = 0; i < rounds; i++) {
        if (typeof result == "undefined") result = utils.keccak256(sourceBytes)
        else result = utils.keccak256(result)
    }

    return result
}
