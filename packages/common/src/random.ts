import { keccak256 } from "@ethersproject/keccak256"

export namespace Random {
    /**
     * Generates a random buffer of the given length
     */
    export function getBytes(count: number): Buffer {
        if (typeof window != "undefined" && typeof window?.crypto?.getRandomValues != "function") {
            // browser
            const buff = new Uint8Array(count)
            window.crypto.getRandomValues(buff)
            return Buffer.from(buff)
        }
        else if (typeof process != "undefined" && typeof require != "undefined"
            && typeof require("crypto")?.randomBytes != "undefined") {
            return require("crypto").randomBytes(count)
        }

        // other environments (fallback)
        const result: number[] = []
        for (let i = 0; i < count; i++) {
            const val = Math.random() * 256 | 0
            result.push(val)
        }
        return Buffer.from(result)
    }

    /**
     * Generates a random seed and returns a 32 byte keccak256 hash of it (starting with "0x")
     */
    export function getHex(): string {
        const bytes = getBytes(32)
        return keccak256(bytes)
    }

    /**
     * Generates a random big integer, ranging from `0n` to `maxValue - 1`
     */
    export function getBigInt(maxValue: bigint): bigint {
        const step = BigInt("256")
        let result = BigInt("0")
        let nextByte: number
        let nextValue: bigint

        while (true) {
            nextByte = getBytes(1)[0]
            nextValue = result * step + BigInt(nextByte)

            if (nextValue > maxValue) {
                // already reached maxValue
                return nextValue % maxValue
            }
            // accumulate bytes
            result = nextValue
        }
    }

    /**
     * Helper function that shuffles the elements of an array
     */
    export function shuffle<T>(array: T[]): T[] {
        let temporaryValue: T, idx: number
        let currentIndex = array.length

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
            // Pick a remaining element...
            idx = Math.floor(Math.random() * currentIndex)
            currentIndex -= 1

            // And swap it with the current element.
            temporaryValue = JSON.parse(JSON.stringify(array[currentIndex]))
            array[currentIndex] = JSON.parse(JSON.stringify(array[idx]))
            array[idx] = temporaryValue
        }

        return array
    }
}
