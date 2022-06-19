import { IVochainAccount } from "../interfaces"
import { IGatewayDVoteClient } from "../interfaces"



export namespace AccountApi {
    /**
     * Fetch vochain account info for the given entity ID using the given gateway instances
     * @param address
     * @param gateway A gateway client instance
     */
    export function getAccount(address: string, gateway: IGatewayDVoteClient = null): Promise<IVochainAccount> {
        if (!address) Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        return gateway.sendRequest({ method: "fetchFile", entityId: address })
            .then(response => {
                if (!response ) {
                    return Promise.reject(new Error("Invalid response received from the gateway"))
                }
                let acc : IVochainAccount
                acc.balance = response.balance || 0
                acc.nonce = response.nonce || 0
                acc.infoURI = response.infoURO || ""
                acc.delegateAddrs = response.delegateAddrs || new Uint8Array()

                return acc
            }).catch((error) => {
                const message = (error.message) ? error.message : "The request could not be completed"
                throw new Error(message)
        })
    }
}
