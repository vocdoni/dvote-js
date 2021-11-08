import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { ContentUri } from "../../src/wrappers/content-uri"
import { ContentHashedUri } from "../../src/wrappers/content-hashed-uri"
import { GatewayInfo } from "../../src/wrappers/gateway-info"

addCompletionHooks()

describe("Wrappers", () => {
    describe("Content URI", () => {
        it("Should create a Content URI from a String", () => {
            const curi = new ContentUri("ipfs://1234,https://server/file,http://server/file")

            expect(curi.items.length).to.equal(3)
            expect(curi.items[0]).to.eq("ipfs://1234")
            expect(curi.items[1]).to.eq("https://server/file")
            expect(curi.items[2]).to.eq("http://server/file")
            expect(curi.ipfsHash).to.equal("1234")
            expect(curi.httpsItems).to.deep.equal(["https://server/file"])
            expect(curi.httpItems).to.deep.equal(["http://server/file"])
        })

        it("Should fail if the URL is empty", () => {
            expect(() => {
                new ContentUri("")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw
        })
    })

    describe("Content Hashed URI", () => {
        it("Should extend the functionality of a Content URI", () => {
            const curi = new ContentHashedUri("ipfs://1234,https://server/file,http://server/file")

            expect(curi.items.length).to.equal(3)
            expect(curi.items[0]).to.eq("ipfs://1234")
            expect(curi.items[1]).to.eq("https://server/file")
            expect(curi.items[2]).to.eq("http://server/file")
            expect(curi.ipfsHash).to.equal("1234")
            expect(curi.httpsItems).to.deep.equal(["https://server/file"])
            expect(curi.httpItems).to.deep.equal(["http://server/file"])
        })

        it("Should fail if more than one ! symbol is present", () => {
            expect(() => {
                new ContentUri("ipfs://1234,https://server/file,http://server/file!1234!5678")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw
        })

        it("Should provide the hash of a hashed Uri", () => {
            const curi = new ContentHashedUri("ipfs://1234,https://server/file,http://server/file!12345678")

            expect(curi.items.length).to.equal(3)
            expect(curi.items[0]).to.eq("ipfs://1234")
            expect(curi.items[1]).to.eq("https://server/file")
            expect(curi.items[2]).to.eq("http://server/file")
            expect(curi.ipfsHash).to.equal("1234")
            expect(curi.httpsItems).to.deep.equal(["https://server/file"])
            expect(curi.httpItems).to.deep.equal(["http://server/file"])
            expect(curi.hash).to.equal("12345678")
        })

        it("Should allow to hash properly", () => {
            const str1 = "Hello world"
            const buff1 = Buffer.from(str1)
            const str2 = "I am a string to be hashed"
            const buff2 = Buffer.from(str2)

            let hash1: string, hash2: string

            // no hash yet
            const curi = new ContentHashedUri("ipfs://1234,https://server/file,http://server/file")
            expect(curi.hash).to.equal(null)

            hash1 = ContentHashedUri.hash(buff1)
            hash2 = ContentHashedUri.hash(buff2)
            expect(hash1).to.equal("64ec88ca00b268e5ba1a35678a1b5316d212f4f366b2477232534a8aeca37f3c")
            expect(hash2).to.equal("56a3222b874d8adaf85265f96793c86085834e7d8bacee269c6a4f3ed1a10525")
            expect(hash1).to.not.equal(hash2)

            // Verify
            const curi1 = new ContentHashedUri(`https://server/file1!${hash1}`)
            expect(curi1.hash).to.eq(hash1)
            expect(curi1.verify(buff1)).to.eq(true)
            const curi2 = new ContentHashedUri(`https://server/file2!${hash2}`)
            expect(curi2.hash).to.eq(hash2)
            expect(curi2.verify(buff2)).to.eq(true)

            // Buffer
            expect(ContentHashedUri.hash(Buffer.from(str1))).to.equal(hash1)
            expect(ContentHashedUri.hash(Buffer.from(str2))).to.equal(hash2)
        })
    })

    describe("Gateway Info", () => {
        it("Should create a Gateway Info from the URI's", () => {
            const curi = new GatewayInfo("wss://server/dvote", ["census", "file", "vote"], "https://server/web3")

            expect(curi.dvote).to.equal("wss://server/dvote")
            expect(curi.supportedApis).to.deep.equal(["census", "file", "vote"])
            expect(curi.web3).to.equal("https://server/web3")

            const curi2 = new GatewayInfo("wss://server2/dvote", ["vote"], "https://server2/web3")

            expect(curi2.dvote).to.equal("wss://server2/dvote")
            expect(curi2.supportedApis).to.deep.equal(["vote"])
            expect(curi2.web3).to.equal("https://server2/web3")
        })

        it("Should fail if a parameter is invalid", () => {
            expect(() => {
                new GatewayInfo("", ["census", "file", "vote"], "")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw

            expect(() => {
                new GatewayInfo("wss://server/dvote", null, "https://server/web3")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw

            expect(() => {
                let random: any = 1234
                new GatewayInfo(random, ["census", "file", "vote"], "")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw
        })
    })
})
