import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Wallet } from "ethers"

import { digestHexClaim } from "../../src/api/census"

addCompletionHooks()

describe("Census", () => {

    describe("Poseidon hashing", () => {
        // // TODO: update once circomlib JS is also updated
        // it("Should be updated once circomlib JS is also updated")

        it("Should hash public keys properly", () => {
            let hexClaim1 = "0x045a126cbbd3c66b6d542d40d91085e3f2b5db3bbc8cda0d59615deb08784e4f833e0bb082194790143c3d01cedb4a9663cb8c7bdaaad839cb794dd309213fcf30"
            let hexHash1 = digestHexClaim(hexClaim1)
            expect(hexHash1).to.equal("EB2a00pTkDYoqlnPUQ49D8wUZ41YPwEVpaoaLr2YY5w=")

            let hexClaim2 = "0x049969c7741ade2e9f89f81d12080651038838e8089682158f3d892e57609b64e2137463c816e4d52f6688d490c35a0b8e524ac6d9722eed2616dbcaf676fc2578"
            let hexHash2 = digestHexClaim(hexClaim2)
            expect(hexHash2).to.equal("HOONvrHcCA8KgfirpKKk1RuHUG3NZimRc+9NcJbJuI8=")

            let hexClaim3 = "0x049622878da186a8a31f4dc03454dbbc62365060458db174618218b51d5014fa56c8ea772234341ae326ce278091c39e30c02fa1f04792035d79311fe3283f1380"
            let hexHash3 = digestHexClaim(hexClaim3)
            expect(hexHash3).to.equal("KdzkitvXvJSqndKmRXAYBFZamdOrN+lFyEGKeYYGJeg=")

            let hexClaim4 = "0x0420606a7dcf293722f3eddc7dca0e2505c08d5099e3d495091782a107d006a7d64c3034184fb4cd59475e37bf40ca43e5e262be997bb74c45a9a723067505413e"
            let hexHash4 = digestHexClaim(hexClaim4)
            expect(hexHash4).to.equal("L3Y/6iJWtc6DyOS+Wad8tFlh8kiZO5BLCOhTHgSpIlc=")

            expect(hexHash1).to.not.equal(hexHash2)
            expect(hexHash1).to.not.equal(hexHash3)
            expect(hexHash2).to.not.equal(hexHash3)
        })

        it("Should fail on invalid hex strings", () => {
            let wallet = Wallet.fromMnemonic("soul frequent purity regret noble husband weapon scheme cement lamp put regular envelope physical entire", "m/44'/60'/0'/0/0")
            let pubKey = wallet["signingKey"].publicKey

            expect(() => {
                digestHexClaim(pubKey)
            }).to.not.throw

            expect(() => {
                digestHexClaim("hello world 1234")
            }).to.throw

            expect(() => {
                digestHexClaim("!\"·$%&")
            }).to.throw

            expect(() => {
                digestHexClaim("")
            }).to.throw

            expect(() => {
                digestHexClaim("ZXCVBNM")
            }).to.throw

            expect(() => {
                digestHexClaim(",.-1234")
            }).to.throw
        })
    })
})
