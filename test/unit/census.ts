import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Wallet, utils } from "ethers"
import { Buffer } from "buffer/"

import { CensusOffChain } from "../../src/api/census"
import { compressPublicKey } from "../../dist/src"
import { Poseidon } from "../../src/crypto/hashing"

addCompletionHooks()

describe("Census", () => {

    describe("Ethereum public keys", () => {
        it("Should encode public keys in base64 properly", () => {
            const inputs = [{
                pubKey: "0x04c52078106449f843a45a0afbee02ae3ddc26f2623a1e7e5bd9de5aed33e0d84ad6262b6d64674237f8583a4663996566f2c7125d1af78a6f0d007c6f068cb7d5",
                result: "A8UgeBBkSfhDpFoK++4Crj3cJvJiOh5+W9neWu0z4NhK"
            }, {
                pubKey: "0x03c52078106449f843a45a0afbee02ae3ddc26f2623a1e7e5bd9de5aed33e0d84a",
                result: "A8UgeBBkSfhDpFoK++4Crj3cJvJiOh5+W9neWu0z4NhK"
            }, {
                pubKey: "0x04f1a72a191db1f3706743037633f8a42a532dd8d00a00f38cc5a9dcb3340957ae340ade9fd420e27c4e1b5d5a944edc07963864e7a8fe96dbcf57a2f2fb0c527b",
                result: "A/GnKhkdsfNwZ0MDdjP4pCpTLdjQCgDzjMWp3LM0CVeu"
            }, {
                pubKey: "0x03f1a72a191db1f3706743037633f8a42a532dd8d00a00f38cc5a9dcb3340957ae",
                result: "A/GnKhkdsfNwZ0MDdjP4pCpTLdjQCgDzjMWp3LM0CVeu"
            }, {
                pubKey: "0x047b31ca12428f31e34b26cf8bfcee724e5a5794fe4f368588dbd247e570a7d77b64cbfa7a975b8afb83fa6410acc090cec5081ad37062c1821a17bbd4b0659a4a",
                result: "AnsxyhJCjzHjSybPi/zuck5aV5T+TzaFiNvSR+Vwp9d7"
            }, {
                pubKey: "0x027b31ca12428f31e34b26cf8bfcee724e5a5794fe4f368588dbd247e570a7d77b",
                result: "AnsxyhJCjzHjSybPi/zuck5aV5T+TzaFiNvSR+Vwp9d7"
            }]

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
        it("Poseidon hashes should digest bigint arrays", () => {
            const BI_0 = BigInt("0")
            const BI_1 = BigInt("1")
            const BI_2 = BigInt("2")
            const BI_3 = BigInt("3")
            const BI_4 = BigInt("4")
            const BI_5 = BigInt("5")
            const BI_6 = BigInt("6")

            let hash = Poseidon.hash([BI_1])
            expect(hash.toString()).to.eq("18586133768512220936620570745912940619677854269274689475585506675881198879027")

            hash = Poseidon.hash([BI_1, BI_2])
            expect(hash.toString()).to.eq("7853200120776062878684798364095072458815029376092732009249414926327459813530")

            hash = Poseidon.hash([BI_1, BI_2, BI_0, BI_0, BI_0])
            expect(hash.toString()).to.eq("1018317224307729531995786483840663576608797660851238720571059489595066344487")

            hash = Poseidon.hash([BI_1, BI_2, BI_0, BI_0, BI_0, BI_0])
            expect(hash.toString()).to.eq("15336558801450556532856248569924170992202208561737609669134139141992924267169")

            hash = Poseidon.hash([BI_3, BI_4, BI_0, BI_0, BI_0])
            expect(hash.toString()).to.eq("5811595552068139067952687508729883632420015185677766880877743348592482390548")

            hash = Poseidon.hash([BI_3, BI_4, BI_0, BI_0, BI_0, BI_0])
            expect(hash.toString()).to.eq("12263118664590987767234828103155242843640892839966517009184493198782366909018")

            hash = Poseidon.hash([BI_1, BI_2, BI_3, BI_4, BI_5, BI_6])
            expect(hash.toString()).to.eq("20400040500897583745843009878988256314335038853985262692600694741116813247201")
        })

        it("Should hash and encode public keys in base64 properly", () => {
            const inputs = [
                { x: BigInt("1"), y: BigInt("2"), result: "EVzA9efWkEE99kxrlmLpzyo2F/J0MkVRnhlgekQXGJo=" },
                { x: BigInt("100000"), y: BigInt("100000"), result: "Fb0RCovJ6nKDCSTXbatstFA76vEHpC8qQ+PBinejjbg=" },
                {
                    x: BigInt("679579282795235884996242115530780050234464918"),
                    y: BigInt("538027861463307969735104848636744652918854385"),
                    result: "LKtphC8tlyKFUB7qccs7+1nh0+UsIcarz4IfsALwDjw="
                },
                {
                    x: BigInt("4258666145857679579282795235884996242115530780050234464918"),
                    y: BigInt("3092735941342538027861463307969735104848636744652918854385"),
                    result: "A/6/CNLfHl02Yz+mHPbjcUrpsc8Vormnj/Tg36srGW4="
                },
                {
                    x: BigInt("2620102959944258666145857679579282795235884996242115530780050234464918323"),
                    y: BigInt("7523554590803092735941342538027861463307969735104848636744652918854385131"),
                    result: "CNgbar35byF3iu4x6tdrmyeAZ+fS2qu4WdZpLr1c3B0="
                },
                {
                    x: BigInt("3942620102959944258666145857679579282795235884996242115530780050234464918323"),
                    y: BigInt("6827523554590803092735941342538027861463307969735104848636744652918854385131"),
                    result: "I3c++IIsisFA8Qc5orNLsBpwmujJYYnfbYugOMz0N9s="
                },
                {
                    x: BigInt("6827523554590803092735941342538027861463307969735104848636744652918854385131"),
                    y: BigInt("3942620102959944258666145857679579282795235884996242115530780050234464918323"),
                    result: "BI8jL4tyWh/EDdhekA1Jg5sNyiXC8jprIXunQk6Hx54="
                },
            ]

            for (let input of inputs) {
                const hashed = CensusOffChain.Anonymous.digestPublicKey(input.x, input.y)
                expect(hashed).to.eq(input.result)
            }
        })

        it("Hashed public keys should be 32 bytes long", () => {
            let buff: Buffer

            const inputs = [
                { x: BigInt("1"), y: BigInt("2"), len: 32 },
                { x: BigInt("100000"), y: BigInt("100000"), len: 32 },
                {
                    x: BigInt("679579282795235884996242115530780050234464918"),
                    y: BigInt("538027861463307969735104848636744652918854385"),
                    len: 32
                },
                {
                    x: BigInt("4258666145857679579282795235884996242115530780050234464918"),
                    y: BigInt("3092735941342538027861463307969735104848636744652918854385"),
                    len: 32
                },
                {
                    x: BigInt("2620102959944258666145857679579282795235884996242115530780050234464918323"),
                    y: BigInt("7523554590803092735941342538027861463307969735104848636744652918854385131"),
                    len: 32
                },
                {
                    x: BigInt("3942620102959944258666145857679579282795235884996242115530780050234464918323"),
                    y: BigInt("6827523554590803092735941342538027861463307969735104848636744652918854385131"),
                    len: 32
                },
                {
                    x: BigInt("6827523554590803092735941342538027861463307969735104848636744652918854385131"),
                    y: BigInt("3942620102959944258666145857679579282795235884996242115530780050234464918323"),
                    len: 32
                },
            ]

            for (let input of inputs) {
                const hashed = CensusOffChain.Anonymous.digestPublicKey(input.x, input.y)
                buff = Buffer.from(hashed, "base64")
                expect(buff.length).to.eq(input.len)
            }
        })
    })
})
