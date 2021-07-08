import { utils } from "ethers"

export function compressPublicKey(pubKey: string | Uint8Array | Buffer | number[]) {
    return utils.computePublicKey(pubKey, true)
}

export function expandPublicKey(pubKey: string | Uint8Array | Buffer | number[]) {
    return utils.computePublicKey(pubKey, false)
}
