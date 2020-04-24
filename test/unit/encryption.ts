import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Wallet } from "ethers"

import { Asymmetric } from "../../src/util/encryption"

addCompletionHooks()

describe("Asymmetric encryption", () => {
    const privateKey = "91f86dd7a9ac258c4908ca8fbdd3157f84d1f74ffffcb9fa428fba14a1d40150"
    const publicKey = "6876524df21d6983724a2b032e41471cc9f1772a9418c4d701fcebb6c306af50"

    const messages = [
        "hello",
        "",
        "!·$%&/)1234567890",
        "UTF-8-charsàèìòù",
        "😃🌟🌹⚖️🚀"
    ]

    it("Should encrypt and recover messages", () => {
        for (let i = 0; i < messages.length; i++) {
            const encrypted = Asymmetric.encryptString(messages[i], publicKey)
            const decrypted = Asymmetric.decryptString(encrypted, privateKey)
            expect(decrypted).to.eq(messages[i])
        }
    })

    it("Should encrypt and recover random messages", () => {
        let wallet: Wallet, encrypted, decrypted
        for (let i = 0; i < 50; i++) {
            wallet = Wallet.createRandom()

            encrypted = Asymmetric.encryptString(wallet.mnemonic, publicKey)
            decrypted = Asymmetric.decryptString(encrypted, privateKey)
            expect(decrypted).to.eq(wallet.mnemonic)
        }
    })

    it("Should correctly decode messages encrypted from PineNaCl", () => {
        let message: string, encryptedBase64: string, decrypted: string

        encryptedBase64 = "oGwQFMUzXgQ6etTz2UT7Q9ZLJgNMOAjPoX3UicN07gY17mvdUuKhj9RGL0iw8z85Cttj3h4="
        decrypted = Asymmetric.decryptString(encryptedBase64, privateKey)
        message = "hello"
        expect(decrypted).to.eq(message)

        encryptedBase64 = "u0z0z7n1c30KHZ7ruB5JDl0CUMKwK8SlR8d/tWBtfQID1k9XOkETSN/0G7/H1ezX"
        decrypted = Asymmetric.decryptString(encryptedBase64, privateKey)
        message = ""
        expect(decrypted).to.eq(message)

        encryptedBase64 = "qRd094S8AjjE+Z+ZrAhzMyLYZNhxkZlJJReOc4zlzSf+R+wx13xixeJEwKg8nbLn5UZBPTEn81SyFQ8fvHwNidld"
        decrypted = Asymmetric.decryptString(encryptedBase64, privateKey)
        message = "!·$%&/)1234567890"
        expect(decrypted).to.eq(message)

        encryptedBase64 = "Mxf7XYKE3VQa/mH3nvKg/tnhj4UntbfsZ6bbkxXe7wZ2/45I9zKAjhSfsolp31GDDSOiSTMud8gSJYkivUneO3RMpbcG"
        decrypted = Asymmetric.decryptString(encryptedBase64, privateKey)
        message = "UTF-8-charsàèìòù"
        expect(decrypted).to.eq(message)

        encryptedBase64 = "rWC6RjIqHtdRvjUIsLAyADZX6MhIahEBOnFq8wUV+iZoF1AzFxzUvlFdHMymVVfe7Ls52jBWhxqvHy7YmUatjdend6BQUQ=="
        decrypted = Asymmetric.decryptString(encryptedBase64, privateKey)
        message = "😃🌟🌹⚖️🚀"
        expect(decrypted).to.eq(message)
    })
})
