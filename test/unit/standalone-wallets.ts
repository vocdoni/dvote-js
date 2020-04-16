import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { utils } from "ethers"

import { walletFromSeededPassphrase, generateRandomHexSeed } from "../../src/util/signers"
import { signJsonBody, isSignatureValid } from "../../src/util/json-sign"

addCompletionHooks()

describe("Standalone Ethereum wallets", () => {
    it("Should generate a new random seed for a standalone wallet", () => {
        const seed1 = generateRandomHexSeed()
        const seed2 = generateRandomHexSeed()
        const seed3 = generateRandomHexSeed()
        const seed4 = generateRandomHexSeed()

        expect(seed1.length).to.eq(66)
        expect(seed2.length).to.eq(66)
        expect(seed3.length).to.eq(66)
        expect(seed4.length).to.eq(66)

        expect(seed1.substr(0, 2)).to.eq('0x')
        expect(seed2.substr(0, 2)).to.eq('0x')
        expect(seed3.substr(0, 2)).to.eq('0x')
        expect(seed4.substr(0, 2)).to.eq('0x')

        expect(seed1.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok
        expect(seed2.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok
        expect(seed3.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok
        expect(seed4.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok

        expect(seed1).to.be.not.eq(seed2)
        expect(seed1).to.be.not.eq(seed3)
        expect(seed1).to.be.not.eq(seed4)
        expect(seed2).to.be.not.eq(seed3)
        expect(seed2).to.be.not.eq(seed4)
        expect(seed3).to.be.not.eq(seed4)
    })

    it("Should return a wallet for the given passphrase and seed", async () => {
        const passphrase = "Hello Dear world 1234"
        const hexSeed = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"

        const wallet = walletFromSeededPassphrase(passphrase, hexSeed)
        expect(wallet.privateKey).to.eq("0x58c6192cbffe39d20f6dbaa2957a6d6a4116489a2bb66caab5c4a0bfa83d887b")
        expect(wallet["signingKey"].publicKey).to.eq("0x04de6d532b6979899729f9e98869888ea7fdbc446f9f3ea732d23c7bcd10c784d041887d48ebc392c4ff51882ae569ca1553f6ab6538664bced6cca6855acbbade")
        expect(await wallet.getAddress()).to.eq("0xf76564CBF51B1F050c84fC01400088ACD2704F2e")

        const msg = utils.toUtf8Bytes("Hello")
        const signature = await wallet.signMessage(msg)
        expect(signature).to.eq("0xc7f89fabf5185f7b63b5f13ad11a79e69412174ed250e6df7116a27588a820cf21aa94a440519e3a19b545e26b457fc39a0b8e904e1ba591f3bbd9842960c58a1c")
    })

    it("Different passphrases should produce different private keys", async () => {
        const passphrase1 = "Hello Dear world 1234"
        const passphrase2 = "This is a different passphrase 10"
        const passphrase3 = "Three passphrases, 3 wallets"
        const passphrase4 = "$More @ UTF-8 © chãrs àèìòù"
        const hexSeed = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"

        const wallet1 = walletFromSeededPassphrase(passphrase1, hexSeed)
        const wallet2 = walletFromSeededPassphrase(passphrase2, hexSeed)
        const wallet3 = walletFromSeededPassphrase(passphrase3, hexSeed)
        const wallet4 = walletFromSeededPassphrase(passphrase4, hexSeed)

        expect(wallet1.privateKey).to.not.eq(wallet2.privateKey)
        expect(wallet1.privateKey).to.not.eq(wallet3.privateKey)
        expect(wallet1.privateKey).to.not.eq(wallet4.privateKey)
        expect(wallet2.privateKey).to.not.eq(wallet3.privateKey)
        expect(wallet2.privateKey).to.not.eq(wallet4.privateKey)
        expect(wallet3.privateKey).to.not.eq(wallet4.privateKey)
    })

    it("Different seeds should produce different private keys", async () => {
        const passphrase = "Hello Dear world 1234"
        const hexSeed1 = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"
        const hexSeed2 = "0xbc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a"
        const hexSeed3 = "0xf51aeecd5cb3cf2b37e005286976d0335c555708ed7bafa1a770a7f2919e96f3"
        const hexSeed4 = "0xaf1410f438190841ad9b39eebc4dfb1d669018ab92a0cb61bba889dd129fad0e"

        const wallet1 = walletFromSeededPassphrase(passphrase, hexSeed1)
        const wallet2 = walletFromSeededPassphrase(passphrase, hexSeed2)
        const wallet3 = walletFromSeededPassphrase(passphrase, hexSeed3)
        const wallet4 = walletFromSeededPassphrase(passphrase, hexSeed4)

        expect(wallet1.privateKey).to.not.eq(wallet2.privateKey)
        expect(wallet1.privateKey).to.not.eq(wallet3.privateKey)
        expect(wallet1.privateKey).to.not.eq(wallet4.privateKey)
        expect(wallet2.privateKey).to.not.eq(wallet3.privateKey)
        expect(wallet2.privateKey).to.not.eq(wallet4.privateKey)
        expect(wallet3.privateKey).to.not.eq(wallet4.privateKey)
    })

    it("Should error if the password is weak", () => {
        const hexSeed = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"

        expect(() => walletFromSeededPassphrase("", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("short", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("SHORT", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("1234", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("abcDEF", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("123abc", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("less-8", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("LESS-8", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("onlyHasLettersButNoNumbers", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("only-lowercase-and-1234", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("aBcD12", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("aBcD123", hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("@$%&_-!=/()", hexSeed)).to.throw()

        expect(() => walletFromSeededPassphrase("aBcD1234", hexSeed)).to.not.throw()
        expect(() => walletFromSeededPassphrase("1234ABCabc", hexSeed)).to.not.throw()
        expect(() => walletFromSeededPassphrase("$symbols-SH@ULD-b3-0K", hexSeed)).to.not.throw()
        expect(() => walletFromSeededPassphrase("Str0nG-pass", hexSeed)).to.not.throw()
        expect(() => walletFromSeededPassphrase("1=GoodPass1234", hexSeed)).to.not.throw()
        expect(() => walletFromSeededPassphrase("N1ceStronG'pass", hexSeed)).to.not.throw()
        expect(() => walletFromSeededPassphrase("4passD0ntCrakM3", hexSeed)).to.not.throw()
        expect(() => walletFromSeededPassphrase("0141d6ab9sd7vn1387naPsSyv2v", hexSeed)).to.not.throw()
        expect(() => walletFromSeededPassphrase("This is a long passphrase with 1 number", hexSeed)).to.not.throw()
    })

    it("Invalid values should error", () => {
        const hexSeed = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"

        expect(() => walletFromSeededPassphrase(1234 as any, hexSeed)).to.throw()
        expect(() => walletFromSeededPassphrase("1234ABCabc", "invalid-seed")).to.throw()
        expect(() => walletFromSeededPassphrase("1234ABCabc", 1234 as any)).to.throw()
    })

    it("Should sign correctly", async () => {
        const hexSeed = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"
        const wallet = walletFromSeededPassphrase("N1ceStronG'pass", hexSeed)

        const jsonBody = { "method": "getVisibility", "timestamp": 1582196988554 }

        const signature = await signJsonBody(jsonBody, wallet)

        expect(isSignatureValid(signature, wallet["signingKey"].publicKey, jsonBody)).to.be.true
    })
})
