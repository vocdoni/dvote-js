import { ContentUri } from "../wrappers/content-uri"
import { ContentHashedUri } from "../wrappers/content-hashed-uri"
import { Gateway, IGateway } from "../net/gateway"
import { DVoteGateway, IDVoteGateway, IRequestParameters } from "../net/gateway-dvote"
import { IGatewayPool, GatewayPool } from "../net/gateway-pool"
import { IPFS } from "../net/ipfs"
import { Buffer } from 'buffer/'
import axios from "axios"
import { Wallet, Signer } from "ethers"

export class FileApi {
    /**
     * Fetch the contents of a file and return them as a string
     *
     * See https://vocdoni.io/docs/#/architecture/components/gateway?id=file-api
     *
     * @param contentUri
     * @param gateway (optional) A Vocdoni Gateway to use
     */
    static fetchString(contentUri: ContentUri | ContentHashedUri | string, gateway: IDVoteGateway | IGateway | IGatewayPool = null): Promise<string> {
        let cUri: ContentUri | ContentHashedUri
        if (typeof contentUri == "string") cUri = new ContentUri(contentUri)
        else cUri = contentUri

        return FileApi.fetchBytes(cUri, gateway).then((bytes: Buffer) => {
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
    static async fetchBytes(contentUri: ContentUri | ContentHashedUri | string, gateway: IDVoteGateway | IGateway | IGatewayPool = null): Promise<Buffer> {
        if (!contentUri) throw new Error("Invalid contentUri")

        let cUri: ContentHashedUri
        if (typeof contentUri == "string") cUri = new ContentHashedUri(contentUri)
        else cUri = new ContentHashedUri(contentUri.toString())

        // Attempt 1: fetch all from the given gateway
        // if ((gateway instanceof DVoteGateway) || (gateway instanceof Gateway) || (gateway instanceof GatewayPool)) {
        if (gateway) {
            try {
                // Connect only if we created the client
                const response = await gateway.sendRequest({ method: "fetchFile", uri: cUri.toContentUriString() })

                if (!response || !response.content) {
                    return Promise.reject(new Error("Invalid response received from the gateway"))
                }

                if (cUri.hash) {
                    // TODO: Compute the SHA3-256 hash of the contents
                    console.warn("TO DO: Compute the SHA3-256 hash of the contents")
                }

                return Buffer.from(response.content, "base64")
            } catch (err) {
                if (err && (err != "The request timed out" && err.message != "The request timed out")) throw err
                // otherwise, continue below
            }
        }

        // Attempt 2: fetch fallback from IPFS public gateways
        if (cUri.ipfsHash) {
            try {
                var response = await IPFS.fetchHash(cUri.ipfsHash)
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
     * @param gateway A string with the Gateway URI or a Gateway object, set with a URI and a public key
     * @return The Content URI friendly URI of the newly added file (ipfs://<hash>)
     */
    static async add(buffer: Uint8Array | string, name: string, walletOrSigner: Wallet | Signer, gateway: IDVoteGateway | IGateway | GatewayPool): Promise<string> {
        if (!buffer) return Promise.reject(new Error("Empty payload"))
        else if (!walletOrSigner) return Promise.reject(new Error("Wallet is required"))

        if (typeof buffer == "string") {
            buffer = new Uint8Array(Buffer.from(buffer))
        }

        const requestBody: IRequestParameters = {
            method: "addFile",
            type: "ipfs",
            name,
            content: Buffer.from(buffer).toString("base64")
        }

        return gateway.sendRequest(requestBody, walletOrSigner)
            .then(response => {
                if (!response || !response.uri) throw new Error("The data could not be uploaded")

                return response.uri
            })
            .catch((error) => {
                const message = (error.message) ? "The data could not be uploaded: " + error.message : "The data could not be uploaded"
                throw new Error(message)
            })
    }

    /**
     * Retrieves the list of pinned filed for the current account
     * @param 1
     * @param 2
     * @param 3
     */
    static async pinList(): Promise<string> {

        throw new Error("TODO: unimplemented")

    }

    /**
     * Pins an extenal IPFS hash to that it becomes persistent
     * @param 1
     * @param 2
     * @param 3
     */
    static async pinFile(): Promise<string> {

        throw new Error("TODO: unimplemented")

    }

    /**
     * Requests to remove the pin of a file
     * @param 1
     * @param 2
     * @param 3
     */
    static async unpinFile(): Promise<string> {

        throw new Error("TODO: unimplemented")

    }
}
