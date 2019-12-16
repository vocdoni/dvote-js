import ContentURI from "../wrappers/content-uri"
import ContentHashedURI from "../wrappers/content-hashed-uri"
import { DVoteGateway, IDvoteRequestParameters } from "../net/gateway"
import { fetchIpfsHash } from "../net/ipfs"
import { Buffer } from 'buffer'
import axios from "axios"
import { Wallet, Signer } from "ethers"
import GatewayInfo from "../wrappers/gateway-info"

/**
 * Fetch the contents of a file and return them as a string
 * 
 * See https://vocdoni.io/docs/#/architecture/components/gateway?id=file-api
 * 
 * @param contentUri 
 * @param gateway (optional) A Vocdoni Gateway to use
 */
export function fetchFileString(contentUri: ContentURI | ContentHashedURI | string, gateway: GatewayInfo | DVoteGateway = null): Promise<string> {
    let cUri: ContentURI | ContentHashedURI
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
 * @param gateway (optional) A Vocdoni Gateway to use
 */
export async function fetchFileBytes(contentUri: ContentURI | ContentHashedURI | string, gateway: GatewayInfo | DVoteGateway = null): Promise<Buffer> {
    if (!contentUri) throw new Error("Invalid contentUri")

    let cUri: ContentHashedURI
    if (typeof contentUri == "string") cUri = new ContentHashedURI(contentUri)
    else cUri = new ContentHashedURI(contentUri.toString())

    // Attempt 1: fetch all from the given gateway
    if (gateway) {
        let gw: DVoteGateway
        if (gateway instanceof DVoteGateway) gw = gateway
        else if (gateway instanceof GatewayInfo) gw = new DVoteGateway(gateway)
        else throw new Error("Invalid Gateway provided")

        try {
            // Connect only if we created the client
            if (gateway instanceof GatewayInfo) await gw.connect()
            const response = await gw.sendMessage({ method: "fetchFile", uri: cUri.toContentUriString() })

            // Disconnect only if we created the client
            if (gateway instanceof GatewayInfo) gw.disconnect()

            if (!response || !response.content) {
                throw new Error("Invalid response received from the gateway")
            }

            if (cUri.hash) {
                // TODO: Compute the SHA3-256 hash of the contents
                console.warn("TO DO: Compute the SHA3-256 hash of the contents")
            }

            return Buffer.from(response.content, "base64")
        } catch (err) {
            // Disconnect only if we created the client
            if (gateway instanceof GatewayInfo) gw.disconnect()

            if (err && (err != "The request timed out" && err.message != "The request timed out")) throw err
            // otherwise, continue below
        }
    }

    // Attempt 2: fetch fallback from IPFS public gateways
    if (cUri.ipfsHash) {
        try {
            var response = await fetchIpfsHash(cUri.ipfsHash)
            if (response) {

                if (cUri.hash) {
                    // TODO: Compute the SHA3-256 hash of the contents
                    console.warn("TO DO: Compute the SHA3-256 hash of the contents")
                }

                return response
            }
        } catch (err) {
            // continue
        }
    }

    // Attempt 3: fetch from fallback https endpoints
    for (let uri of cUri.httpsItems) {
        try {
            const res = await axios.get(uri)
            if (!res || !res.data || res.status < 200 || res.status >= 300) continue
            else if (cUri.hash) {
                // TODO: Compute the SHA3-256 hash of the contents
                console.warn("TO DO: Compute the SHA3-256 hash of the contents")
            }

            // If the response is not a string, it's because it has been parsed
            // into a JSON object, so we stringify it back
            if (typeof res.data != "string") {
                res.data = JSON.stringify(res.data)
            }
            return Buffer.from(res.data)
        } catch (err) {
            // keep trying
            continue
        }
    }

    // Attempt 4: fetch from fallback http endpoints
    for (let uri of cUri.httpItems) {
        try {
            const res = await axios.get(uri)
            if (!res || !res.data || res.status < 200 || res.status >= 300) continue
            else if (cUri.hash) {
                // TODO: Compute the SHA3-256 hash of the contents
                console.warn("TO DO: Compute the SHA3-256 hash of the contents")
            }

            // If the response is not a string, it's because it has been parsed
            // into a JSON object, so we stringify it back
            if (typeof res.data != "string") {
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
 * @param gateway A string with the Gateway URI or a DVoteGateway object, set with a URI and a public key
 * @return The Content URI friendly URI of the newly added file (ipfs://<hash>)
 */
export async function addFile(buffer: Uint8Array | string, name: string, walletOrSigner: Wallet | Signer, gateway: GatewayInfo | DVoteGateway): Promise<string> {
    if (!buffer) throw new Error("Empty payload")
    else if (!walletOrSigner) throw new Error("Wallet is required")
    else if (!gateway) throw new Error("A gateway is required")

    if (typeof buffer == "string") {
        buffer = new Uint8Array(Buffer.from(buffer))
    }

    let gw: DVoteGateway
    if (gateway instanceof DVoteGateway) gw = gateway
    else if (gateway instanceof GatewayInfo) {
        gw = new DVoteGateway(gateway)
        await gw.connect()
    }
    else throw new Error("Invalid Gateway provided")

    const requestBody: IDvoteRequestParameters = {
        method: "addFile",
        type: "ipfs",
        name,
        content: Buffer.from(buffer).toString("base64")
    }

    return gw.sendMessage(requestBody, walletOrSigner).then(response => {
        // Disconnect only if we created the client
        if (gateway instanceof GatewayInfo) gw.disconnect()

        if (!response || !response.uri) throw new Error("The data could not be uploaded")

        return response.uri
    })
}

/**
 * Retrieves the list of pinned filed for the current account
 * @param 1 
 * @param 2 
 * @param 3
 */
export async function pinList(): Promise<string> {

    throw new Error("TODO: unimplemented")

}

/**
 * Pins an extenal IPFS hash to that it becomes persistent
 * @param 1 
 * @param 2 
 * @param 3
 */
export async function pinFile(): Promise<string> {

    throw new Error("TODO: unimplemented")

}

/**
 * Requests to remove the pin of a file
 * @param 1 
 * @param 2 
 * @param 3
 */
export async function unpinFile(): Promise<string> {

    throw new Error("TODO: unimplemented")

}
