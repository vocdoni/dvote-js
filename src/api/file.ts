import ContentURI from "../util/content-uri"
import { VocGateway, RequestParameters } from "../net/gateway"
import { fetchIpfsHash } from "../net/ipfs"
import { Buffer } from 'buffer'
import axios from "axios"
import { Wallet, Signer } from "ethers"
// import { JsonRpcSigner } from "ethers/providers"

/**
 * Fetch the contents of a file and return them as a string
 * 
 * See https://vocdoni.io/docs/#/architecture/components/gateway?id=file-api
 * 
 * @param contentUri 
 * @param gateway (optional) A Vocdoni Gateway instance
 */
export function fetchFileString(contentUri: ContentURI | string, gateway: VocGateway | string): Promise<string> {
    let cUri: ContentURI
    if (typeof contentUri == "string") cUri = new ContentURI(contentUri)
    else cUri = contentUri

    return fetchFileBytes(cUri, gateway).then((bytes: Buffer) => {
        return bytes.toString()
    })
}

/**
 * Fetch the contents of a file and return them as a byte array
 * 
 * See https://vocdoni.io/docs/#/architecture/components/gateway?id=file-api
 * 
 * @param contentUri 
 * @param gateway (optional) A Vocdoni Gateway instance
 */
export async function fetchFileBytes(contentUri: ContentURI | string, gateway: VocGateway | string = null): Promise<Buffer> {
    if (!contentUri) throw new Error("Invalid contentUri")

    let cUri: ContentURI
    if (typeof contentUri == "string") cUri = new ContentURI(contentUri)
    else cUri = contentUri

    // Attempt 1: fetch all from the given gateway
    if (gateway) {
        let gw: VocGateway
        if (typeof gateway == "string") {
            gw = new VocGateway(gateway)
        }
        else if (!(gateway instanceof VocGateway)) {
            throw new Error("Invalid Gateway provided")
        }
        else {
            gw = gateway
        }

        try {
            const response = await gw.sendMessage({ method: "fetchFile", uri: cUri.toString() })
            if (!response || !response.content) {
                throw "Invalid response received from the gateway"
            }

            // Disconnect if the VocGateway connection was created by the function
            if (typeof gateway == "string") gw.disconnect()

            return Buffer.from(response.content, "base64")
        } catch (err) {
            // Disconnect if the VocGateway connection was created by the function
            if (typeof gateway == "string") gw.disconnect()

            if (err != "The request timed out") throw err
            // otherwise, continue below
        }
    }

    // Attempt 2: fetch fallback from IPFS public gateways
    if (cUri.ipfsHash()) {
        try {
            var response = await fetchIpfsHash(cUri.ipfsHash())
            if (response) return response
        } catch (err) {
            // continue
        }
    }

    // Attempt 3: fetch from fallback https endpoints
    for (let uri in cUri.httpsItems()) {
        try {
            const res = await axios.get(uri)
            if (!res || !res.data || res.status >= 300) continue
            // If the response is not a string, it's because it has been parsed
            // into a JSON object, so we stringify it back
            else if (typeof res.data != "string") {
                res.data = JSON.stringify(res.data)
            }
            return Buffer.from(res.data)
        } catch (err) {
            // keep trying
            continue
        }
    }

    // Attempt 4: fetch from fallback http endpoints
    for (let uri in cUri.httpItems()) {
        try {
            const res = await axios.get(uri)
            if (!res || !res.data || res.status >= 300) continue
            // If the response is not a string, it's because it has been parsed
            // into a JSON object, so we stringify it back
            else if (typeof res.data != "string") {
                res.data = JSON.stringify(res.data)
            }
            return Buffer.from(res.data)
        } catch (err) {
            // keep trying
            continue
        }
    }

    throw new Error("Unable to connect to the network")
}

/**
 * Upload static data to decentralized P2P filesystems. 
 * 
 * See https://vocdoni.io/docs/#/architecture/components/gateway?id=add-file
 * 
 * @param buffer Uint8Array or string with the file contents
 * @param type What type of P2P protocol should be used
 * @param wallet An Ethers.js wallet capable of signing the payload
 * @param gateway A string with the Gateway URI or a VocGateway object, set with a URI and a public key
 * @return The URI of the newly added file
 */
export function addFile(buffer: Uint8Array | string, name: string, walletOrSigner: Wallet | Signer, gateway: VocGateway | string): Promise<string> {
    if (!buffer) throw new Error("Empty payload")
    else if (!walletOrSigner) throw new Error("Wallet is required")
    else if (!gateway) throw new Error("A gateway is required")

    if (typeof buffer == "string") {
        buffer = new Uint8Array(Buffer.from(buffer))
    }

    let gw: VocGateway
    if (typeof gateway == "string") {
        gw = new VocGateway(gateway)
    }
    else if (!(gateway instanceof VocGateway)) {
        throw new Error("Invalid Gateway provided")
    }
    else {
        gw = gateway
    }

    const requestBody: RequestParameters = {
        method: "addFile",
        type: "ipfs",
        name,
        content: Buffer.from(buffer).toString("base64"),
        timestamp: Date.now()
    }

    return gw.sendMessage(requestBody, walletOrSigner).then(response => {
        // Disconnect if the VocGateway connection was created by the function
        if (typeof gateway == "string") gw.disconnect()

        if (!response || !response.uri) throw new Error("The data could not be uploaded")

        return response.uri
    })
}
