import { BigNumber } from "@ethersproject/bignumber"
import { ContractReceipt } from "@ethersproject/contracts"
import { JsonRpcProvider, Web3Provider, IpcProvider, InfuraProvider } from "@ethersproject/providers"
import { Signer } from "@ethersproject/abstract-signer"
import { Wallet } from "@ethersproject/wallet"
import { IGatewayWeb3Client } from "@vocdoni/client"
import { ERC20Proof } from "@vocdoni/storage-proofs-eth"

export namespace CensusErc20Api {
    export function generateProof(tokenAddress: string, holderAddress: string, tokenBalanceMappingPosition: number, blockNumber: number | "latest", provider: JsonRpcProvider | Web3Provider | IpcProvider | InfuraProvider) {
        return ERC20Proof.get(tokenAddress, holderAddress, tokenBalanceMappingPosition, blockNumber, provider)
    }

    export function verifyProof(stateRoot: string, address: string, proof: any) {
        return ERC20Proof.verify(stateRoot, address, proof)
    }

    /** Finds the balance mapping position of the given ERC20 token address and attempts to register it on the blockchain */
    export async function registerTokenAuto(tokenAddress: string, walletOrSigner: Wallet | Signer, gw: IGatewayWeb3Client, customContractAddress?: string): Promise<ContractReceipt> {
        const contractInstance = await gw.getTokenStorageProofInstance(walletOrSigner, customContractAddress)

        const mapSlot = await CensusErc20Api.findBalanceMappingPosition(tokenAddress, await walletOrSigner.getAddress(), gw.provider as JsonRpcProvider)
        if (mapSlot === null) throw new Error("The given token contract does not seem to have a defined mapping position for the holder balances")

        const tx = await contractInstance.registerToken(tokenAddress, mapSlot)
        return tx.wait()
    }

    /** Associates the given balance mapping position to the given ERC20 token address  */
    export function registerToken(tokenAddress: string, balanceMappingPosition: number | BigNumber, walletOrSigner: Wallet | Signer, gw: IGatewayWeb3Client, customContractAddress?: string): Promise<ContractReceipt> {
        return gw.getTokenStorageProofInstance(walletOrSigner, customContractAddress)
            .then((contractInstance) =>
                contractInstance.registerToken(tokenAddress,
                    balanceMappingPosition
                )
            )
            .then(tx => tx.wait())
    }

    /** Overwrites the token's balance mapping position as long as the provided proof is valid */
    export function setVerifiedBalanceMappingPosition(tokenAddress: string, balanceMappingPosition: number | BigNumber, blockNumber: number | BigNumber, blockHeaderRLP: Buffer, accountStateProof: Buffer, storageProof: Buffer, walletOrSigner: Wallet | Signer, gw: IGatewayWeb3Client, customContractAddress?: string): Promise<ContractReceipt> {
        return gw.getTokenStorageProofInstance(walletOrSigner, customContractAddress)
            .then((contractInstance) =>
                contractInstance.setVerifiedBalanceMappingPosition(tokenAddress,
                    balanceMappingPosition,
                    blockNumber,
                    blockHeaderRLP,
                    accountStateProof,
                    storageProof
                )
            )
            .then(tx => tx.wait())
    }

    export function getTokenInfo(tokenAddress: string, gw: IGatewayWeb3Client, customContractAddress?: string): Promise<{ isRegistered: boolean, isVerified: boolean, balanceMappingPosition: number }> {
        return gw.getTokenStorageProofInstance(null, customContractAddress)
            .then((contractInstance) => contractInstance.tokens(tokenAddress))
            .then((tokenDataTuple) => {
                const balanceMappingPosition = BigNumber.isBigNumber(tokenDataTuple[2]) ?
                    tokenDataTuple[2].toNumber() : tokenDataTuple[2]

                return {
                    isRegistered: tokenDataTuple[0],
                    isVerified: tokenDataTuple[1],
                    balanceMappingPosition
                }
            })
    }

    // Helpers

    /**
     * Attempts to find the index at which the holder balances are stored within the token contract.
     * If the position cannot be found among the 50 first ones, `null` is returned.
     */
    export function findBalanceMappingPosition(tokenAddress: string, holderAddress: string, provider: JsonRpcProvider) {
        return ERC20Proof.findMapSlot(tokenAddress, holderAddress, provider)
    }
}
