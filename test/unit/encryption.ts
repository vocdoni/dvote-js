import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Wallet } from "ethers"

import { Asymmetric, Symmetric } from "../../src/util/encryption"
import { Buffer } from "buffer/"

addCompletionHooks()

describe("Asymmetric encryption", () => {
    const privateKey = "91f86dd7a9ac258c4908ca8fbdd3157f84d1f74ffffcb9fa428fba14a1d40150"
    const publicKey = "6876524df21d6983724a2b032e41471cc9f1772a9418c4d701fcebb6c306af50"

    const messages = [
        "hello",
        "",
        "!·$%&/)1234567890",
        "UTF-8-charsàèìòù",
        "😃🌟🌹⚖️🚀",
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    ]
    const buffers = messages.map(msg => Buffer.from(msg))
    const randomMessages = (() => { const msgs = []; for (let i = 0; i < 80; i++) msgs.push(Wallet.createRandom().mnemonic.phrase); return msgs })()

    it("Should encrypt and recover messages", () => {
        for (let i = 0; i < messages.length; i++) {
            const encrypted = Asymmetric.encryptString(messages[i], publicKey)
            const decrypted = Asymmetric.decryptString(encrypted, privateKey)
            expect(decrypted).to.eq(messages[i])
        }
    })

    it("Should encrypt and recover byte arrays from base64", () => {
        for (let i = 0; i < buffers.length; i++) {
            const encrypted = Asymmetric.encryptBytes(buffers[i], publicKey)
            const decrypted = Asymmetric.decryptBytes(encrypted, privateKey)
            expect(decrypted.join(",")).to.eq(buffers[i].join(","))
        }
    })

    it("Should encrypt and recover byte arrays", () => {
        for (let i = 0; i < buffers.length; i++) {
            const encrypted = Asymmetric.encryptRaw(buffers[i], publicKey)
            const decrypted = Asymmetric.decryptRaw(encrypted, privateKey)
            expect(decrypted.join(",")).to.eq(buffers[i].join(","))
        }
    })

    it("Should encrypt and recover random byte arrays", () => {
        let buffer: Buffer, encrypted: Buffer, decrypted: Buffer
        for (let i = 0; i < randomMessages.length; i++) {
            buffer = Buffer.from(randomMessages[i])
            encrypted = Asymmetric.encryptRaw(buffer, publicKey)
            decrypted = Asymmetric.decryptRaw(encrypted, privateKey)
            expect(decrypted.join(",")).to.eq(buffer.join(","))
        }
    })

    it("Should encrypt and recover random byte arrays from base64", () => {
        let buffer: Buffer, encrypted: string, decrypted: Buffer
        for (let i = 0; i < randomMessages.length; i++) {
            buffer = Buffer.from(randomMessages[i])
            encrypted = Asymmetric.encryptBytes(buffer, publicKey)
            decrypted = Asymmetric.decryptBytes(encrypted, privateKey)
            expect(decrypted.join(",")).to.eq(buffer.join(","))
        }
    })

    it("Should encrypt and recover random messages", () => {
        let encrypted, decrypted
        for (let i = 0; i < randomMessages.length; i++) {
            encrypted = Asymmetric.encryptString(randomMessages[i], publicKey)
            decrypted = Asymmetric.decryptString(encrypted, privateKey)
            expect(decrypted).to.eq(randomMessages[i])
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

describe("Symmetric encryption", () => {
    const dvoteFlutterMessages = [{
        "passphrase": "garlic",
        "encryptedMsg": "X8cIdo87E/m6M9ftVqHtRV4CMGzo2joROusJFmXVMqMdQpoixtGaD6Qp0SdkfA==",
        "originalMsg": "onions",
    }, {
        "passphrase": "joint",
        "encryptedMsg": "mivKii/v/ab8uXsK4w1Jo4cdfUB58/b0vhmvIrmiBLHGRvBJNVpHpSu5haz5",
        "originalMsg": "blunt",
    }, , {
        "passphrase": "joint",
        "encryptedMsg": "pjbGHEV1fISNGliw1lvn5nr12DfrQ2XDeNKQXsYS187UKkO/B0Pg4xiS0VK1",
        "originalMsg": "blunt",
    }]

    const messages = [
        "hello",
        "",
        "!·$%&/)1234567890",
        "UTF-8-charsàèìòù",
        "😃🌟🌹⚖️🚀",
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    ]
    const buffers = messages.map(msg => Buffer.from(msg))
    const randomMessages = (() => { const msgs = []; for (let i = 0; i < 80; i++) msgs.push(Wallet.createRandom().mnemonic.phrase); return msgs })()

    it("Should recover messages encrypted by dvote-flutter-crypto", () => {

        dvoteFlutterMessages.map(test => {
            const decrypted = Symmetric.decryptString(test.encryptedMsg, test.passphrase)
            expect(decrypted).to.eq(test.originalMsg)
        })
    })

    it("Should encrypt and recover messages", () => {
        for (let i = 0; i < messages.length; i++) {
            const encrypted = Symmetric.encryptString(messages[i], messages[i])
            const decrypted = Symmetric.decryptString(encrypted, messages[i])
            expect(decrypted).to.eq(messages[i])
        }
    })

    it("Should encrypt and recover byte arrays from base64", () => {
        for (let i = 0; i < buffers.length; i++) {
            const encrypted = Symmetric.encryptBytes(buffers[i], messages[messages.length-1-i])
            const decrypted = Symmetric.decryptBytes(encrypted, messages[messages.length-1-i])
            expect(decrypted.join(",")).to.eq(buffers[i].join(","))
        }
    })

    it("Should encrypt and recover byte arrays", () => {
        for (let i = 0; i < buffers.length; i++) {
            const encrypted = Symmetric.encryptRaw(buffers[i], messages[i])
            const decrypted = Symmetric.decryptRaw(encrypted, messages[i])
            expect(decrypted.join(",")).to.eq(buffers[i].join(","))
        }
    })

    it("Should encrypt and recover random byte arrays", () => {
        let buffer: Buffer, encrypted: Buffer, decrypted: Buffer
        for (let i = 0; i < randomMessages.length; i++) {
            buffer = Buffer.from(randomMessages[i])
            encrypted = Symmetric.encryptRaw(buffer, messages[0])
            decrypted = Symmetric.decryptRaw(encrypted, messages[0])
            expect(decrypted.join(",")).to.eq(buffer.join(","))
        }
    })

    it("Should encrypt and recover random byte arrays from base64", () => {
        let buffer: Buffer, encrypted: string, decrypted: Buffer
        for (let i = 0; i < randomMessages.length; i++) {
            buffer = Buffer.from(randomMessages[i])
            encrypted = Symmetric.encryptBytes(buffer, messages[0])
            decrypted = Symmetric.decryptBytes(encrypted, messages[0])
            expect(decrypted.join(",")).to.eq(buffer.join(","))
        }
    })

    it("Should encrypt and recover random messages", () => {
        let encrypted, decrypted
        for (let i = 0; i < randomMessages.length; i++) {
            encrypted = Symmetric.encryptString(randomMessages[i], messages[0])
            decrypted = Symmetric.decryptString(encrypted, messages[0])
            expect(decrypted).to.eq(randomMessages[i])
        }
    })
})