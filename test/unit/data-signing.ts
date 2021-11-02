import "mocha" // using @types/mocha
import { expect, } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { TextEncoder, TextDecoder } from "util"

import { extractUint8ArrayJSONValue } from "../../src/util/uint8array" // TODO: Has to be imported from new package `gateway` and move remaining tests there

addCompletionHooks()

describe("JSON signing", () => {
    it("Should extract correctly the bytes of the value of a JSON field", () => {
        const innerBody = '{ "a":"àèìòù", "b": "áéíóú" }'
        const jsonBody = '{ "response":' + innerBody + '}'
        const bytesBody = new TextEncoder().encode(jsonBody)
        const extractedValue = new TextDecoder("utf-8").decode(extractUint8ArrayJSONValue(bytesBody, "response"))
        expect(extractedValue).to.equal(innerBody)
    })
    it("Should correctly extract messages singed by go-dvote", () => {
        const innerBodyHex = "7b226d656d62657273223a5b7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a2266657272616e40766f63646f6e692e696f222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a2246657272616e222c226964223a2239353461663662312d663338382d346463302d396666372d613834346330313531363464222c226c6173744e616d65223a2246657272222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a226c6175406d61696c2e636f6d222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a224c6175222c226964223a2239633766393235332d643539302d346438622d613839622d336137663931303038643766222c226c6173744e616d65223a224c6175222c227075626c69634b6579223a224250654845555761716573306e65596a4847626d7537526e484a354c4d366372374d714a745436304f674b4b4a5a77767350686e524949706e716a775349374b4b384e697a744b316e6f6742787a7373324b48497435513d222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22323032302d31312d30335431363a34333a31352e3730313331392b30313a3030227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a226d616e6f7340766f63646f6e692e696f222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a224d616e222c226964223a2239336564356637352d353238352d346466372d623830642d376434383362373332663063222c226c6173744e616d65223a224d616e73222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a2273746566406d61696c2e636f6d222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a2253746566222c226964223a2234373536393638612d616266662d343734662d383962622d313535343232333732323935222c226c6173744e616d65223a2253746566222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a226c6f67696e7340766f63646f6e692e696f222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a224c6f67696e73222c226964223a2239383265646665342d633832622d346263372d616261662d663436393635336238653934222c226c6173744e616d65223a22566f63222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d5d2c226f6b223a747275652c2272657175657374223a2237633361383963396335222c2274696d657374616d70223a313630353130333430347d"
        const innerBodyBytes = Uint8Array.from(Buffer.from(innerBodyHex, 'hex'))
        const bodyHex = "7b22726573706f6e7365223a7b226d656d62657273223a5b7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a2266657272616e40766f63646f6e692e696f222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a2246657272616e222c226964223a2239353461663662312d663338382d346463302d396666372d613834346330313531363464222c226c6173744e616d65223a2246657272222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a226c6175406d61696c2e636f6d222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a224c6175222c226964223a2239633766393235332d643539302d346438622d613839622d336137663931303038643766222c226c6173744e616d65223a224c6175222c227075626c69634b6579223a224250654845555761716573306e65596a4847626d7537526e484a354c4d366372374d714a745436304f674b4b4a5a77767350686e524949706e716a775349374b4b384e697a744b316e6f6742787a7373324b48497435513d222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22323032302d31312d30335431363a34333a31352e3730313331392b30313a3030227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a226d616e6f7340766f63646f6e692e696f222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a224d616e222c226964223a2239336564356637352d353238352d346466372d623830642d376434383362373332663063222c226c6173744e616d65223a224d616e73222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a2273746566406d61696c2e636f6d222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a2253746566222c226964223a2234373536393638612d616266662d343734662d383962622d313535343232333732323935222c226c6173744e616d65223a2253746566222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d2c7b22636f6e73656e746564223a66616c73652c22637265617465644174223a22303030312d30312d30315430303a30303a30305a222c22646174654f664269727468223a22303030312d30312d30315430303a30393a32312b30303a3039222c22656d61696c223a226c6f67696e7340766f63646f6e692e696f222c22656e746974794964223a226748582f776b594c49574c39567a722b71467545516a2f32656b5930644a444355616368783471767971303d222c2266697273744e616d65223a224c6f67696e73222c226964223a2239383265646665342d633832622d346263372d616261662d663436393635336238653934222c226c6173744e616d65223a22566f63222c22757064617465644174223a22303030312d30312d30315430303a30303a30305a222c227665726966696564223a22303030312d30312d30315430303a30393a32312b30303a3039227d5d2c226f6b223a747275652c2272657175657374223a2237633361383963396335222c2274696d657374616d70223a313630353130333430347d2c226964223a2237633361383963396335222c227369676e6174757265223a2236336431313130333137653664643336646138336161623061353865633337646439623031353738633631333034386630646666346630323438353033393865376337313531393738333833666530623730306565633734636365626563633538353435386263653132313930386636376531366235376337316130333864633031227d"
        const bodyBytes = Uint8Array.from(Buffer.from(bodyHex, 'hex'))
        expect(innerBodyBytes.toString()).to.equal(extractUint8ArrayJSONValue(bodyBytes, "response").toString())

    })
})
