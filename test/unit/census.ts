import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Wallet } from "ethers"

import { digestHexClaim } from "../../src/api/census"

addCompletionHooks()

describe("Census", () => {

    describe("Poseidon hashing", () => {
        it("Should hash public keys properly", () => {
            // 1
            let wallet = Wallet.fromMnemonic("fly cheap color olive setup rigid april forum over grief predict pipe toddler argue give", "m/44'/60'/0'/0/0")
            let pubKey = wallet["signingKey"].publicKey  // 0x04...
            const hash1 = digestHexClaim(pubKey)
            expect(hash1).to.equal("ILtGMAKtwhkcRM80o+L3FLeQWTUx9wN+rhIpxzFZsHo=")

            // 2
            wallet = Wallet.fromMnemonic("kangaroo improve enroll almost since stock travel grace improve welcome orbit decorate govern hospital select", "m/44'/60'/0'/0/0")
            pubKey = wallet["signingKey"].publicKey  // 0x04...
            const hash2 = digestHexClaim(pubKey)
            expect(hash2).to.equal("L8Y2jIRV7BjNw7pFrIzJ/PR41Bx3RcTPR7FAN44Gug==")

            // 3
            wallet = Wallet.fromMnemonic("soup sunset inhale lend eagle hold reduce churn alpha torch leopard phrase unfold crucial soccer", "m/44'/60'/0'/0/0")
            pubKey = wallet["signingKey"].publicKey  // 0x04...
            const hash3 = digestHexClaim(pubKey)
            expect(hash3).to.equal("ITbzM8xwQF+n6yHftMu7mUlVxmIvvs5Sa7K9aOCtKQ==")

            expect(hash1).to.not.equal(hash2)
            expect(hash1).to.not.equal(hash3)
            expect(hash2).to.not.equal(hash3)
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
