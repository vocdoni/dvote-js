import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Wallet } from "ethers"

import { sortObjectFields, signJsonBody, isSignatureValid, recoverSignerPublicKey } from "../../src/util/json-sign"

addCompletionHooks()

describe("JSON signing", () => {
    it("Should reorder JSON objects alphabetically", () => {
        let strA = JSON.stringify(sortObjectFields("abc"))
        let strB = JSON.stringify(sortObjectFields("abc"))
        expect(strA).to.equal(strB)

        strA = JSON.stringify(sortObjectFields(123))
        strB = JSON.stringify(sortObjectFields(123))
        expect(strA).to.equal(strB)

        strA = JSON.stringify(sortObjectFields({}))
        strB = JSON.stringify(sortObjectFields({}))
        expect(strA).to.equal(strB)

        strA = JSON.stringify(sortObjectFields({ a: 1, b: 2 }))
        strB = JSON.stringify(sortObjectFields({ b: 2, a: 1 }))
        expect(strA).to.equal(strB)

        strA = JSON.stringify(sortObjectFields({ a: 1, b: { c: 3, d: 4 } }))
        strB = JSON.stringify(sortObjectFields({ b: { d: 4, c: 3 }, a: 1 }))
        expect(strA).to.equal(strB)

        strA = JSON.stringify(sortObjectFields({ a: 1, b: [2, 3, 4, 5] }))
        strB = JSON.stringify(sortObjectFields({ b: [2, 3, 4, 5], a: 1 }))
        expect(strA).to.equal(strB)
    })
    it("Should sign a JSON payload, regardless of the order of the fields", async () => {
        let wallet = new Wallet("8d7d56a9efa4158d232edbeaae601021eb3477ad77b5f3c720601fd74e8e04bb")

        const jsonBody1 = { "method": "getVisibility", "timestamp": 1582196988554 }
        const jsonBody2 = { "timestamp": 1582196988554, "method": "getVisibility" }

        const signature1 = await signJsonBody(jsonBody1, wallet)
        const signature2 = await signJsonBody(jsonBody2, wallet)

        expect(signature1).to.equal("0xc99cf591678a1eb545d9c77cf6b8d3873552624c3631e77c82cc160f8c9593354f369a4e57e8438e596073bbe89c8f4474ba45bae2ca7f6c257a0a879d10d4281b")
        expect(signature2).to.equal("0xc99cf591678a1eb545d9c77cf6b8d3873552624c3631e77c82cc160f8c9593354f369a4e57e8438e596073bbe89c8f4474ba45bae2ca7f6c257a0a879d10d4281b")
    })
    it("Should produce and recognize valid signatures, regardless of the order of the fields", async () => {
        let wallet = new Wallet("8d7d56a9efa4158d232edbeaae601021eb3477ad77b5f3c720601fd74e8e04bb")

        const jsonBody1 = { "method": "getVisibility", "timestamp": 1582196988554 }
        const jsonBody2 = { "timestamp": 1582196988554, "method": "getVisibility" }

        const signature1 = await signJsonBody(jsonBody1, wallet)
        const signature2 = await signJsonBody(jsonBody2, wallet)

        expect(isSignatureValid(signature1, wallet["signingKey"].publicKey, jsonBody1)).to.be.true
        expect(isSignatureValid(signature2, wallet["signingKey"].publicKey, jsonBody2)).to.be.true
    })
    it("Should recover the public key from a JSON and a signature", async () => {
        let wallet = new Wallet("8d7d56a9efa4158d232edbeaae601021eb3477ad77b5f3c720601fd74e8e04bb")

        const jsonBody1 = { a: 1, b: "hi", c: false, d: [1, 2, 3, 4, 5, 6] }
        const jsonBody2 = { d: [1, 2, 3, 4, 5, 6], c: false, b: "hi", a: 1 }

        const signature1 = await signJsonBody(jsonBody1, wallet)
        const signature2 = await signJsonBody(jsonBody2, wallet)

        const recoveredPubKey1 = recoverSignerPublicKey(jsonBody1, signature1)
        const recoveredPubKey2 = recoverSignerPublicKey(jsonBody2, signature2)

        expect(recoveredPubKey1).to.equal(recoveredPubKey2)
        expect(recoveredPubKey1).to.equal(wallet["signingKey"].publicKey)
        expect(recoveredPubKey1).to.equal("0x04cb3cabb521d84fc998b5649d6b59e27a3e27633d31cc0ca6083a00d68833d5caeaeb67fbce49e44f089a28f46a4d815abd51bc5fc122065518ea4adb199ba780")
    })
})
