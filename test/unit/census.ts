import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Wallet } from "ethers"

import { digestHexClaim } from "../../src/api/census"

addCompletionHooks()

describe("Census", () => {

    describe("Poseidon hashing", () => {
        // TODO: update once circomlib JS is also updated
        it("Should be updated once circomlib JS is also updated")

        // it("Should hash public keys properly", () => {
        //     // 1
        //     let wallet = Wallet.fromMnemonic("fly cheap color olive setup rigid april forum over grief predict pipe toddler argue give", "m/44'/60'/0'/0/0")
        //     let pubKey = wallet["signingKey"].publicKey  // 0x04...
        //     const hash1 = digestHexClaim(pubKey)
        //     expect(hash1).to.equal("A69fOQ6ObtcUgXMdFgMSbQnhk4+F6tnC/NyYokgZrc0=")

        //     // 2
        //     wallet = Wallet.fromMnemonic("kangaroo improve enroll almost since stock travel grace improve welcome orbit decorate govern hospital select", "m/44'/60'/0'/0/0")
        //     pubKey = wallet["signingKey"].publicKey  // 0x04...
        //     const hash2 = digestHexClaim(pubKey)
        //     expect(hash2).to.equal("HuboX6y+3LHrhFy1cfQ/u6QAY9PvB6Yg98aELzJH7kU=")

        //     // 3
        //     wallet = Wallet.fromMnemonic("soup sunset inhale lend eagle hold reduce churn alpha torch leopard phrase unfold crucial soccer", "m/44'/60'/0'/0/0")
        //     pubKey = wallet["signingKey"].publicKey  // 0x04...
        //     const hash3 = digestHexClaim(pubKey)
        //     expect(hash3).to.equal("LQ5YLnHQiYagbk3f1YfQbNEM3TZNddKyulHpUpTzCw4=")

        //     // 4
        //     wallet = Wallet.fromMnemonic("soul frequent purity regret noble husband weapon scheme cement lamp put regular envelope physical entire", "m/44'/60'/0'/0/0")
        //     pubKey = wallet["signingKey"].publicKey  // 0x04...
        //     const hash4 = digestHexClaim(pubKey)
        //     expect(hash4).to.equal("DJRuAQL3tnEqD4m+hvQLX4cXkeSgmrxVLR2bUc6ofCI=")

        //     expect(hash1).to.not.equal(hash2)
        //     expect(hash1).to.not.equal(hash3)
        //     expect(hash2).to.not.equal(hash3)
        // })

        // it("Should fail on invalid hex strings", () => {
        //     let wallet = Wallet.fromMnemonic("soul frequent purity regret noble husband weapon scheme cement lamp put regular envelope physical entire", "m/44'/60'/0'/0/0")
        //     let pubKey = wallet["signingKey"].publicKey

        //     expect(() => {
        //         digestHexClaim(pubKey)
        //     }).to.not.throw

        //     expect(() => {
        //         digestHexClaim("hello world 1234")
        //     }).to.throw

        //     expect(() => {
        //         digestHexClaim("!\"·$%&")
        //     }).to.throw

        //     expect(() => {
        //         digestHexClaim("")
        //     }).to.throw

        //     expect(() => {
        //         digestHexClaim("ZXCVBNM")
        //     }).to.throw

        //     expect(() => {
        //         digestHexClaim(",.-1234")
        //     }).to.throw
        // })
    })
})
