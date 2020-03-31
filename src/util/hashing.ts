import { createHash } from "circomlib/src/poseidon.js"
import { leBuff2int } from "circomlib/src/utils.js"
import * as bigInt from "big-integer"

const Q = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617")
const T = 6

export function hash(arr: bigInt.BigInteger[]) {
    const poseidonHash = createHash()
    return poseidonHash(arr)
}

export function multiHash(arr: bigInt.BigInteger[]): bigInt.BigInteger {
    // TODO: check bigints inside finite field

    let r = bigInt(1)
    for (let i = 0; i < arr.length; i += T - 1) {
        const toHash: bigInt.BigInteger[] = []
        let j = 0
        for (; j < T - 1; j++) {
            if (i + j >= arr.length) break
            toHash[j] = arr[i + j]
        }
        toHash[j] = r
        j++
        for (; j < T; j++) {
            toHash[j] = bigInt(0)
        }

        const ph = hash(toHash)

        r = r.add(ph)
        r = r.mod(Q)
    }
    return r
}

export function hashBuffer(msgBuff: number[] | Uint8Array) {
    const n = 31
    const msgArray = []
    const fullParts = Math.floor(msgBuff.length / n)

    for (let i = 0; i < fullParts; i++) {
        const v = leBuff2int(msgBuff.slice(n * i, n * (i + 1)))
        msgArray.push(v)
    }

    if (msgBuff.length % n !== 0) {
        const v = leBuff2int(msgBuff.slice(fullParts * n))
        msgArray.push(v)
    }
    return multiHash(msgArray)
}
