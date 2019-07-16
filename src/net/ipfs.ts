import { ipfsGatewayListUri } from "../constants"
import axios from "axios"
import { Buffer } from 'buffer'

/**
 * Attempt to fetch a file from the list of well-known IPFS gateways
 * @param hash IPFS raw hash (no leading protocol)
 */
export async function fetchIpfsHash(hash: string): Promise<Buffer> {
    const response = await axios.get(ipfsGatewayListUri)

    if (!Array.isArray(response.data)) throw new Error("Could not fetch the IPFS gateway list")

    for (let gw of response.data) {
        try {
            const res = await axios.get(gw.replace(/:hash$/g, hash))
            return Buffer.from(res.data)
        } catch (err) {
            continue
        }
    }
}
