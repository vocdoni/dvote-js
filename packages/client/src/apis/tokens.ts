import { allSettled } from "@vocdoni/common"
import { ITokenStorageProofContract } from "@vocdoni/contract-wrappers"
import { IGatewayClient, IGatewayWeb3Client } from "../interfaces"

export namespace Erc20TokensApi {
    /**
     * Retrieve the addresses of all the ERC20 tokens registered on the contract.
     * @param gateway A gateway client instance
     */
    export async function getTokenList(gateway: IGatewayClient): Promise<string[]> {
        let tokenInstance: ITokenStorageProofContract
        return gateway.getTokenStorageProofInstance()
            .then(instance => {
                tokenInstance = instance

                return tokenInstance.tokenCount()
            }).then(count => {
                const indexes = new Array(count).fill(0).map((_, i) => i)

                // TODO Promise.allSettled is the correct one, should be used when target = ES2020 is fixed
                return allSettled(indexes.map(idx => getTokenAddressAt(idx, gateway)))
            }).then(results => {
                return results
                    .filter(item => item.status === "fulfilled")
                    .map((item: { status: string, value: any }) => item.value)
            })
    }

    // NOTE: This function mimics CensusErc20Api.getTokenAddressAt, in order to prevent unnecessary coupling
    //       with the census library
    function getTokenAddressAt(index: number, gw: IGatewayWeb3Client, customContractAddress?: string): Promise<string> {
        return gw.getTokenStorageProofInstance(null, customContractAddress)
            .then((contractInstance) => contractInstance.tokenAddresses(index))
    }
}
