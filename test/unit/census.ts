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
            expect(hexHash1).to.not.equal(hexHash4)
            expect(hexHash2).to.not.equal(hexHash3)
            expect(hexHash2).to.not.equal(hexHash4)
            expect(hexHash3).to.not.equal(hexHash4)
        })

        it("Hashed public keys should be 32 bytes long", () => {
            let hexClaim1 = "0x04c94699a259ec27e1cf67fe46653f0dc2f38e6d32abb33b45fc9ffe793171a44b4ff5c9517c1be22f8a47915debcf1e512717fe33986f287e79d2f3099725f179"
            let hexHash1 = digestHexClaim(hexClaim1)
            expect(hexHash1).to.equal("AEqwLqSkyHJ+WHatCuM6xdFRaZ2oIfSjhyCAJao6k7g=")
            const buff1 = Buffer.from(hexHash1, "base64")
            expect(buff1.length).to.eq(32)

            let hexClaim2 = "0x0424a71e7c24b38aaeeebbc334113045885bfae154071426e21c021ebc47a5a85a3a691a76d8253ce6e03bf4e8fe154c89b2d967765bb060e61360305d1b8df7c5"
            let hexHash2 = digestHexClaim(hexClaim2)
            expect(hexHash2).to.equal("ABFnLa7ZGDakME6T8kD7euvLtfYjO1Q5OZ3F4u1PDPc=")
            const buff2 = Buffer.from(hexHash2, "base64")
            expect(buff2.length).to.eq(32)

            let hexClaim3 = "0x04ff51151c6bd759d723af2d0571df5e794c28b204242f4b540b0d3449eab192cafd44b241c96b39fa7dd7ead2d2265a598a23cba0f54cb79b9829d355d74304a2"
            let hexHash3 = digestHexClaim(hexClaim3)
            expect(hexHash3).to.equal("AEsqOOrJwnOBleUz09Y2AdcsvWWy1QHWj6UG+FDBLok=")
            const buff3 = Buffer.from(hexHash3, "base64")
            expect(buff3.length).to.eq(32)

            let hexClaim4 = "0x043f10ff1b295bf4d2f24c40c93cce04210ae812dd5ad1a06d5dafd9a2e18fa1247bdf36bef6a9e45e97d246cfb8a0ab25c406cf6fe7569b17e83fd6d33563003a"
            let hexHash4 = digestHexClaim(hexClaim4)
            expect(hexHash4).to.equal("ACv4XLyQcQurGszQ1kEPd0iN4+LeLgnxxO2TSittLAg=")
            const buff4 = Buffer.from(hexHash4, "base64")
            expect(buff4.length).to.eq(32)
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
