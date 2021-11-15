import axios from "axios"
import { Buffer } from 'buffer/'
import { Random, IPFS_GATEWAY_LIST_URI } from "@vocdoni/common"

export class IPFS {
    /**
     * Attempt to fetch a file from the list of well-known IPFS gateways
     * @param hash IPFS raw hash (no leading protocol)
     */
    static fetchHash(hash: string): Promise<Buffer> {
        return axios.get(IPFS_GATEWAY_LIST_URI)
            .then(response => {
                if (!Array.isArray(response.data)) throw new Error("Could not fetch the IPFS gateway list")
                const gwSelection = Random.shuffle(response.data).slice(0, 3)

                return Promise.race(gwSelection.map(gwUri => {
                    return axios.get(gwUri.replace(/:hash$/g, hash))
                        .then(res => Buffer.from(res.data))
                }))
            })
    }
}
