import {
    BigInteger,
    blind as _blind,
    Point,
    pointFromHex as _pointFromHex,
    signatureFromHex as _signatureFromHex,
    signatureToHex as _signatureToHex,
    unblind as _unblind,
    UnblindedSignature,
    UserSecretData,
    verify as _verify
} from "blindsecp256k1"
import { hexZeroPad } from "@ethersproject/bytes"
import { ensure0x } from "@vocdoni/common"

export namespace CensusBlind {
    /** Decodes the given hex-encoded point */
    export function decodePoint(hexPoint: string): Point {
        return _pointFromHex(hexPoint)
    }

    /** Blinds the given hex string using the given R point and returns the secret data to unblind an eventual blinded signature */
    export function blind(hexMessage: string, signerR: Point): { hexBlinded: string, userSecretData: UserSecretData } {
        const msg = BigInteger.fromHex(hexMessage)
        const { mBlinded, userSecretData } = _blind(msg, signerR)

        return { hexBlinded: hexZeroPad(ensure0x(mBlinded.toString(16)), 32).slice(2), userSecretData }
    }

    /** Unblinds the given blinded signature and returns it as a hex string */
    export function unblind(hexBlindedSignature: string, userSecretData: UserSecretData): string {
        const sBlind = BigInteger.fromHex(hexBlindedSignature)
        const unblindedSignature = _unblind(sBlind, userSecretData)

        return _signatureToHex(unblindedSignature)
    }

    /** Verifies that the given blind signature is valid */
    export function verify(hexMsg: string, hexUnblindedSignature: string, pk: Point) {
        const msg = BigInteger.fromHex(hexMsg)

        const unblindedSignature = signatureFromHex(hexUnblindedSignature)

        return _verify(msg, unblindedSignature, pk)
    }

    /** Deserializes the given hex Signature */
    export function signatureFromHex(hexSignature: string) {
        return _signatureFromHex(hexSignature)
    }

    /** Serializes the given signature into a hex string */
    export function signatureToHex(signature: UnblindedSignature) {
        return _signatureToHex(signature)
    }
}
