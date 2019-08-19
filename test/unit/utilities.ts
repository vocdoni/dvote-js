import "mocha" // using @types/mocha
import { expect } from "chai"

import ContentUri from "../../src/util/content-uri"
import ContentHashedUri from "../../src/util/content-hashed-uri"
import GatewayUri from "../../src/util/gateway-uri"

describe("Utilities", () => {
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
    })

    describe("Gateway URI", () => {
        it("Should create a Gateway URI from a String", () => {
            const curi = new GatewayUri("wss://server/dvote", "wss://server/census", "https://server/web3")

            expect(curi.dvote).to.equal("wss://server/dvote")
            expect(curi.census).to.equal("wss://server/census")
            expect(curi.web3).to.equal("https://server/web3")
        })

        it("Should fail if a URI is empty", () => {
            expect(() => {
                new GatewayUri("", "wss://server/census", "https://server/web3")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw

            expect(() => {
                new GatewayUri("wss://server/dvote", "", "https://server/web3")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw

            expect(() => {
                new GatewayUri("wss://server/dvote", "wss://server/census", "")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw
        })
    })
})
