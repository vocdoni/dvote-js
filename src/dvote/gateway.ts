// NOTE:
// 
// This component is meant to be a simple communication wrapper.
// It should be agnostic to any logic invoving an Entity or a Voting Process.

import axios from "axios"
import { parseURL } from 'universal-parse-url'
import { Wallet } from "ethers"

const ipv4v6Pattern = /((^\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\s*$)|(^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$))/
type IPAddress = string
type ContentURI = string
type MessagingURI = string


export default class Gateway {

    // internal variables
    gatewayIp: IPAddress

    /**
     * Create a Gateway object, bound to work with the given IP address and port
     * @param gatewayIp 
     */
    constructor(gatewayIp: IPAddress) {
        if (!gatewayIp || !gatewayIp.match(ipv4v6Pattern)) throw new Error("Invalid Gateway IP address")

        this.gatewayIp = gatewayIp
    }

    /**
     * Fetch static data from the given Content URI
     * @param contentUri
     */
    public async fetchFile(contentUri: ContentURI): Promise<string> {
        if (!contentUri) throw new Error("Invalid Content URI")

        const origins = contentUri.split(",")

        let response: string
        for (let origin of origins) {
            const url = parseURL(origin)
            if (!url) continue

            try {
                switch (url.protocol) {
                    case "bzz:":
                        response = await this.fetchBzz(origin)
                        break
                    case "bzz-feed:":
                        response = await this.fetchBzzFeed(origin)
                        break
                    case "ipfs:":
                        response = await this.fetchIpfs(origin)
                        break
                    case "https:":
                        response = await axios.get(origin).then(response => response.data)
                        break
                    default:
                        console.warn("Skipping fetch requests to", url.protocol)
                        continue
                }
                return response
            }
            catch (err) {
                // if the request fails, we try the next origin
                continue
            }
        }

        throw new Error("The content is not available")
    }

    /**
     * Send a message using the given messaging URI
     * @param messagingUri
     */
    public async sendMessage(messagingUri: MessagingURI, payload: string): Promise<string> {
        if (!messagingUri) throw new Error("Invalid Content URI")

        const origins = messagingUri.split(",")

        let response: string
        for (let origin of origins) {
            const url = parseURL(origin)
            if (!url) continue

            try {
                switch (url.protocol) {
                    case "pss:":
                        response = await this.sendPssMessage(origin, payload)
                        break
                    case "pubsub:":
                        response = await this.sendPubSubMessage(origin, payload)
                        break
                    case "shh:":
                        response = await this.sendWhisperMessage(origin, payload)
                        break
                    default:
                        console.warn("Skipping fetch requests to", url.protocol)
                        continue
                }
                return response
            }
            catch (err) {
                // if the request fails, we try the next origin
                continue
            }
        }

        throw new Error("The content is not available")
    }

    /**
     * Fetch static data from the given Content URI
     * @param contentUri
     * @return The content URI of the newly added file
     */
    public async addFile(payload: string, protocol: "bzz" | "bzz-feed" | "ipfs", wallet: Wallet): Promise<ContentURI> {
        if (!payload) throw new Error("Empty payload")
        else if (!protocol) throw new Error("Empty protocol")
        else if (!wallet) throw new Error("Empty wallet")

        const address = await wallet.getAddress()
        const signature = await wallet.sign({ data: payload })

        switch (protocol) {
            case "bzz":
                return this.addBzzFile(payload, signature, address)
            case "bzz-feed":
                return this.addBzzFeedFile(payload, signature, address)
            case "ipfs":
                return this.addIpfsFile(payload, signature, address)
            default:
                throw new Error("Unsupported protocol: " + protocol)
        }
    }

    // INTERNAL HANDLERS

    // content fetch

    fetchBzz(origin: string): Promise<string> {
        throw new Error("unimplemented") // TODO:
    }

    fetchBzzFeed(origin: string): Promise<string> {
        throw new Error("unimplemented") // TODO:
    }

    fetchIpfs(origin: string): Promise<string> {
        throw new Error("unimplemented") // TODO:
    }

    // messaging

    sendPssMessage(origin: string, payload: string): Promise<string> {
        throw new Error("unimplemented") // TODO:
    }

    sendPubSubMessage(origin: string, payload: string): Promise<string> {
        throw new Error("unimplemented") // TODO:
    }

    sendWhisperMessage(origin: string, payload: string): Promise<string> {
        throw new Error("unimplemented") // TODO:
    }

    // adding content

    addBzzFile(payload: string, signature: string, address: string): Promise<string> {
        return Promise.reject(new Error("unimplemented"))
    }
    addBzzFeedFile(payload: string, signature: string, address: string): Promise<string> {
        return Promise.reject(new Error("unimplemented"))
    }
    addIpfsFile(payload: string, signature: string, address: string): Promise<string> {
        return Promise.reject(new Error("unimplemented"))
    }
}
