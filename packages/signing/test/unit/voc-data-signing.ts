import "mocha" // using @types/mocha
import { expect, } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { computePublicKey } from "@ethersproject/signing-key"
import { Wallet } from "@ethersproject/wallet"

import { JsonSignatureVocdoni, BytesSignatureVocdoni } from "../../src"

const MAIN_CHAIN_ID = "production"
const ALT_CHAIN_ID = "dvelopment"
const DUMMY_WALLET_SK = "8d7d56a9efa4158d232edbeaae601021eb3477ad77b5f3c720601fd74e8e04bb"

addCompletionHooks()

describe("Salted Vocdoni", () => {
  describe("JSON signing", () => {
    it("Should sign a JSON payload, regardless of the order of the fields", async () => {
      const wallet = new Wallet(DUMMY_WALLET_SK)

      const jsonBody1 = { "method": "getVisibility", "timestamp": 1582196988554 }
      const jsonBody2 = { "timestamp": 1582196988554, "method": "getVisibility" }

      const signature1 = await JsonSignatureVocdoni.sign(jsonBody1, MAIN_CHAIN_ID, wallet)
      const signature2 = await JsonSignatureVocdoni.sign(jsonBody2, MAIN_CHAIN_ID, wallet)

      expect(signature1).to.equal("0xc60131b9c2cc2a847b6a08193cf9cac8f87c58102cc2b4f73b2140409a035b441f21ed260cc6743b185b99570630adea208961bc04ef2215c2f5fca614c4bb361c")
      expect(signature2).to.equal("0xc60131b9c2cc2a847b6a08193cf9cac8f87c58102cc2b4f73b2140409a035b441f21ed260cc6743b185b99570630adea208961bc04ef2215c2f5fca614c4bb361c")
    })
    it("Should produce and recognize valid signatures, regardless of the order of the fields (isValid)", async () => {
      const wallet = new Wallet(DUMMY_WALLET_SK)

      const jsonBody1 = { "method": "getVisibility", "timestamp": 1582196988554 }
      const jsonBody2 = { "timestamp": 1582196988554, "method": "getVisibility" }

      const signature1 = await JsonSignatureVocdoni.sign(jsonBody1, MAIN_CHAIN_ID, wallet)
      const signature2 = await JsonSignatureVocdoni.sign(jsonBody2, MAIN_CHAIN_ID, wallet)

      expect(JsonSignatureVocdoni.isValid(signature1, computePublicKey(wallet.publicKey, true), jsonBody1, MAIN_CHAIN_ID)).to.be.true
      expect(JsonSignatureVocdoni.isValid(signature2, computePublicKey(wallet.publicKey, true), jsonBody2, MAIN_CHAIN_ID)).to.be.true
      expect(JsonSignatureVocdoni.isValid(signature1, wallet.publicKey, jsonBody1, MAIN_CHAIN_ID)).to.be.true
      expect(JsonSignatureVocdoni.isValid(signature2, wallet.publicKey, jsonBody2, MAIN_CHAIN_ID)).to.be.true
    })
    it("Should recover the public key from a JSON and a signature", async () => {
      const wallet = new Wallet(DUMMY_WALLET_SK)

      const jsonBody1 = { a: 1, b: "hi", c: false, d: [1, 2, 3, 4, 5, 6] }
      const jsonBody2 = { d: [1, 2, 3, 4, 5, 6], c: false, b: "hi", a: 1 }

      const signature1 = await JsonSignatureVocdoni.sign(jsonBody1, MAIN_CHAIN_ID, wallet)
      const signature2 = await JsonSignatureVocdoni.sign(jsonBody2, MAIN_CHAIN_ID, wallet)

      const recoveredPubKeyComp1 = JsonSignatureVocdoni.recoverPublicKey(jsonBody1, signature1, MAIN_CHAIN_ID)
      const recoveredPubKeyComp2 = JsonSignatureVocdoni.recoverPublicKey(jsonBody2, signature2, MAIN_CHAIN_ID)
      const recoveredPubKey1 = JsonSignatureVocdoni.recoverPublicKey(jsonBody1, signature1, MAIN_CHAIN_ID, true)
      const recoveredPubKey2 = JsonSignatureVocdoni.recoverPublicKey(jsonBody2, signature2, MAIN_CHAIN_ID, true)

      expect(recoveredPubKeyComp1).to.equal(recoveredPubKeyComp2)
      expect(recoveredPubKeyComp1).to.equal(computePublicKey(wallet.publicKey, true))
      expect(recoveredPubKeyComp1).to.equal("0x02cb3cabb521d84fc998b5649d6b59e27a3e27633d31cc0ca6083a00d68833d5ca")

      expect(recoveredPubKey1).to.equal(recoveredPubKey2)
      expect(recoveredPubKey1).to.equal(wallet.publicKey)
      expect(recoveredPubKey1).to.equal("0x04cb3cabb521d84fc998b5649d6b59e27a3e27633d31cc0ca6083a00d68833d5caeaeb67fbce49e44f089a28f46a4d815abd51bc5fc122065518ea4adb199ba780")
    })
    it("Should recover the public key from a JSON with UTF-8 data and a signature", async () => {
      const wallet = new Wallet(DUMMY_WALLET_SK)

      const jsonBody1 = { a: "àèìòù", b: "áéíóú" }
      const jsonBody2 = { b: "áéíóú", a: "àèìòù" }

      const signature1 = await JsonSignatureVocdoni.sign(jsonBody1, MAIN_CHAIN_ID, wallet)
      const signature2 = await JsonSignatureVocdoni.sign(jsonBody2, MAIN_CHAIN_ID, wallet)

      const recoveredPubKeyComp1 = JsonSignatureVocdoni.recoverPublicKey(jsonBody1, signature1, MAIN_CHAIN_ID)
      const recoveredPubKeyComp2 = JsonSignatureVocdoni.recoverPublicKey(jsonBody2, signature2, MAIN_CHAIN_ID)
      const recoveredPubKey1 = JsonSignatureVocdoni.recoverPublicKey(jsonBody1, signature1, MAIN_CHAIN_ID, true)
      const recoveredPubKey2 = JsonSignatureVocdoni.recoverPublicKey(jsonBody2, signature2, MAIN_CHAIN_ID, true)

      expect(recoveredPubKeyComp1).to.equal(recoveredPubKeyComp2)
      expect(recoveredPubKeyComp1).to.equal(computePublicKey(wallet.publicKey, true))
      expect(recoveredPubKeyComp1).to.equal("0x02cb3cabb521d84fc998b5649d6b59e27a3e27633d31cc0ca6083a00d68833d5ca")

      expect(recoveredPubKey1).to.equal(recoveredPubKey2)
      expect(recoveredPubKey1).to.equal(wallet.publicKey)
      expect(recoveredPubKey1).to.equal("0x04cb3cabb521d84fc998b5649d6b59e27a3e27633d31cc0ca6083a00d68833d5caeaeb67fbce49e44f089a28f46a4d815abd51bc5fc122065518ea4adb199ba780")
    })
    it("Should correctly verify signature of messages singed by go-dvote")
    // it("Should correctly verify signature of messages singed by go-dvote", () => {
    //   const bodyHex = "7b226d656d62657273223a5b7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a2266657272616e40766f63646f6e692e696f222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a2246657272616e222c226964223a2239353461663662312d663338382d346463302d396666372d613834346330313531363464222c226c6173744e616d65223a2246657272222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a226c6175406d61696c2e636f6d222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a224c6175222c226964223a2239633766393235332d643539302d346438622d613839622d336137663931303038643766222c226c6173744e616d65223a224c6175222c227075626c69634b6579223a224250654845555761716573306e65596a4847626d7537526e484a354c4d366372374d714a745436304f674b4b4a5a77767350686e524949706e716a775349374b4b384e697a744b316e6f6742787a7373324b48497435513d222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22323032302d31312d30335431363a34333a31352e3730313331392b30313a3030227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a226d616e6f7340766f63646f6e692e696f222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a224d616e222c226964223a2239336564356637352d353238352d346466372d623830642d376434383362373332663063222c226c6173744e616d65223a224d616e73222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a2273746566406d61696c2e636f6d222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a2253746566222c226964223a2234373536393638612d616266662d343734662d383962622d313535343232333732323935222c226c6173744e616d65223a2253746566222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a226c6f67696e7340766f63646f6e692e696f222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a224c6f67696e73222c226964223a2239383265646665342d633832622d346263372d616261662d663436393635336238653934222c226c6173744e616d65223a22566f63222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d5d2c226f6b223a747275652c2272657175657374223a2265383161373166376633222c2274696d657374616d70223a313630353130333934377d"
    //   const bodyBytes = Uint8Array.from(Buffer.from(bodyHex, 'hex'))
    //   const signature = "8d2945bd594622e73d0d8b9cf536571f4ffbd3f37c911e1dd1e3b59be9872a8c708adb5a0cbe8d658165bcd6ff05a0f91456f248824b02a121dfc98b6524942200"
    //   const publicKey = "026d619ede0fe5db4213acec7a989b46f94b00fdfb28f80532e1182037f36e2ef3"
    //   expect(BytesSignatureVocdoni.isValid(signature, publicKey, bodyBytes, MAIN_CHAIN_ID)).to.be.true
    // })
    it("Should create the same signature as go-dvote")
    // it("Should create the same signature as go-dvote", async () => {
    //   const wallet = new Wallet("c6446f24d08a34fdefc2501d6177b25e8a1d0f589b7a06f5a0131e9a8d0307e4")
    //   const jsonBody = '{"a":"1"}'
    //   const bytesBody = new TextEncoder().encode(jsonBody)
    //   let signature = await BytesSignatureVocdoni.sign(bytesBody, MAIN_CHAIN_ID, wallet)
    //   signature = signature.substring(0, signature.length - 2)
    //   let expectedSignature = "0x79fe1148abee08c131853f1c53ea299e357166256cf6f6bfe2531bab84f25a16175b30d7dfaecb68191bf8d6d0389954bbf8748d8942de9d0b502e3f75462cac"
    //   expectedSignature = expectedSignature.substring(0, expectedSignature.length - 2)
    //   expect(signature).to.equal(expectedSignature)
    // })
  })

  describe("Bytes signing", () => {
    it("Should produce and recognize valid signatures with UTF-8 data", async () => {
      const wallet = new Wallet(DUMMY_WALLET_SK)
      const publicKeyComp = computePublicKey(wallet.publicKey, true)
      const publicKey = wallet.publicKey

      const jsonBody1 = '{ "a": "àèìòù", "b": "áéíóú" }'
      const jsonBody2 = '{ "b": "test&", "a": "&test" }'
      const jsonBody3 = '{ "b": "😃🌟🌹⚖️🚀", "a": "&test" }'

      const bytesBody1 = new TextEncoder().encode(jsonBody1)
      const bytesBody2 = new TextEncoder().encode(jsonBody2)
      const bytesBody3 = new TextEncoder().encode(jsonBody3)

      const signature1 = await BytesSignatureVocdoni.sign(bytesBody1, ALT_CHAIN_ID, wallet)
      const signature2 = await BytesSignatureVocdoni.sign(bytesBody2, ALT_CHAIN_ID, wallet)
      const signature3 = await BytesSignatureVocdoni.sign(bytesBody3, ALT_CHAIN_ID, wallet)

      expect(BytesSignatureVocdoni.isValid(signature1, publicKeyComp, bytesBody1, ALT_CHAIN_ID)).to.be.true
      expect(BytesSignatureVocdoni.isValid(signature2, publicKeyComp, bytesBody2, ALT_CHAIN_ID)).to.be.true
      expect(BytesSignatureVocdoni.isValid(signature3, publicKeyComp, bytesBody3, ALT_CHAIN_ID)).to.be.true
      expect(BytesSignatureVocdoni.isValid(signature1, publicKey, bytesBody1, ALT_CHAIN_ID)).to.be.true
      expect(BytesSignatureVocdoni.isValid(signature2, publicKey, bytesBody2, ALT_CHAIN_ID)).to.be.true
      expect(BytesSignatureVocdoni.isValid(signature3, publicKey, bytesBody3, ALT_CHAIN_ID)).to.be.true
    })
    it("Should produce and recognize valid signatures, regardless of the order of the fields", async () => {
      const wallet = new Wallet(DUMMY_WALLET_SK)

      const jsonBody1 = '{ "method": "getVisibility", "timestamp": 1582196988554 }'
      const bytesBody1 = new TextEncoder().encode(jsonBody1)
      const jsonBody2 = '{ "timestamp": 1582196988554, "method": "getVisibility" }'
      const bytesBody2 = new TextEncoder().encode(jsonBody2)

      const signature1 = await BytesSignatureVocdoni.sign(bytesBody1, MAIN_CHAIN_ID, wallet)
      const signature2 = await BytesSignatureVocdoni.sign(bytesBody2, MAIN_CHAIN_ID, wallet)

      expect(BytesSignatureVocdoni.isValid(signature1, computePublicKey(wallet.publicKey, true), bytesBody1, MAIN_CHAIN_ID)).to.be.true
      expect(BytesSignatureVocdoni.isValid(signature2, computePublicKey(wallet.publicKey, true), bytesBody2, MAIN_CHAIN_ID)).to.be.true
      expect(BytesSignatureVocdoni.isValid(signature1, wallet.publicKey, bytesBody1, MAIN_CHAIN_ID)).to.be.true
      expect(BytesSignatureVocdoni.isValid(signature2, wallet.publicKey, bytesBody2, MAIN_CHAIN_ID)).to.be.true
    })
  })
})
