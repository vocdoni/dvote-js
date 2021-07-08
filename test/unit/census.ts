import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Wallet, utils } from "ethers"
import { Buffer } from "buffer/"

import { CensusOffChain } from "../../src/api/census"
import { compressPublicKey } from "../../dist"

addCompletionHooks()

describe("Census", () => {

    describe("Ethereum public keys", () => {
        it("Should encode public keys in base64 properly", () => {
            // TODO: Add values
            const inputs = [
                { pubKey: "", result: "" },
            ]

            for (let input of inputs) {
                const hashed = CensusOffChain.Public.encodePublicKey(input.pubKey)
                expect(hashed).to.eq(input.result)
            }
        })

        it("Should accept both compressed an uncompressed keys", () => {
            for (let i = 0; i < 10; i++) {
                let wallet = Wallet.createRandom()
                const compressed = utils.computePublicKey(wallet.publicKey, true)
                const uncompressed = wallet.publicKey

                const hashed1 = CensusOffChain.Public.encodePublicKey(compressed)
                const hashed2 = CensusOffChain.Public.encodePublicKey(uncompressed)
                expect(hashed1).to.eq(hashed2)
            }
        })

        it("Should fail on invalid hex strings", () => {
            const wallet = Wallet.fromMnemonic("soul frequent purity regret noble husband weapon scheme cement lamp put regular envelope physical entire", "m/44'/60'/0'/0/0")

            let pubKey = compressPublicKey(wallet.publicKey)
            expect(() => {
                CensusOffChain.Public.encodePublicKey(pubKey)
            }).to.not.throw

            pubKey = wallet.publicKey
            expect(() => {
                CensusOffChain.Public.encodePublicKey(pubKey)
            }).to.not.throw

            expect(() => {
                CensusOffChain.Public.encodePublicKey("hello world 1234")
            }).to.throw

            expect(() => {
                CensusOffChain.Public.encodePublicKey("!\"·$%&")
            }).to.throw

            expect(() => {
                CensusOffChain.Public.encodePublicKey("")
            }).to.throw

            expect(() => {
                CensusOffChain.Public.encodePublicKey("ZXCVBNM")
            }).to.throw

            expect(() => {
                CensusOffChain.Public.encodePublicKey(",.-1234")
            }).to.throw
        })
    })

    describe("Poseidon hashing", () => {
        it("Should hash and encode public keys in base64 properly", () => {
            // TODO: Add values
            const inputs = [
                { x: BigInt("0"), y: BigInt("0"), result: "" },
            ]

            for (let input of inputs) {
                const hashed = CensusOffChain.Anonymous.digestPublicKey(input.x, input.y)
                expect(hashed).to.eq(input.result)
            }
        })

        it("Hashed public keys should be 32 bytes long", () => {
            let buff: Buffer

            // TODO: Add values
            const inputs = [
                { x: BigInt("0"), y: BigInt("0"), len: 32 },
            ]

            for (let input of inputs) {
                const hashed = CensusOffChain.Anonymous.digestPublicKey(input.x, input.y)
                buff = Buffer.from(hashed, "base64")
                expect(buff.length).to.eq(input.len)
            }
        })
    })
})
