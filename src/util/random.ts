import { utils } from "ethers"

export class Random {
    /**
     * Generates a random seed and returns a 32 byte keccak256 hash of it (starting with "0x")
     */
    static getHex(): string {
        if (typeof window != "undefined" && window?.crypto?.getRandomValues) { // Browser
            const bytes = new Uint8Array(32)
            window.crypto.getRandomValues(bytes)

            return utils.keccak256(bytes)
        } else if (typeof process != "undefined") { // NodeJS
            var crypto
            if (typeof require != "undefined") {
                crypto = require("crypto")
            }
            const bytes = crypto.randomBytes(32)
            return utils.keccak256(bytes)
        } else { // Other?
            const payload = Math.random().toString() + Math.random().toString() + Date.now().toString() + Math.random().toString() + Math.random().toString()
            const bytes = utils.toUtf8Bytes(payload)
            return utils.keccak256(bytes)
        }
    }

    /**
     * Helper function that shuffles the elements of an array
     */
    static shuffle<T>(array: T[]): T[] {
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
