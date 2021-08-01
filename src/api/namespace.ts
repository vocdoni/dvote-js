import { Wallet, Signer } from "ethers"
import { IGatewayWeb3Client } from "../common"

type NamespaceData = { namespace: number, chainId: string, genesis: string, validators: string[], oracles: string[] }

export namespace NamespaceApi {
    export async function set(namespace: number, chainId: string, genesis: string, validators: string[], oracles: string[], walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client) {
        if (typeof namespace != "number" || namespace < 0 || namespace > 65355) return Promise.reject(new Error("Invalid namespace"))
        else if (!Array.isArray(validators)) return Promise.reject(new Error("Invalid validators array"))
        else if (!Array.isArray(oracles)) return Promise.reject(new Error("Invalid oracles array"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        try {
            const namespaceInstance = await gateway.getNamespacesInstance(walletOrSigner)

            const tx = await namespaceInstance.setNamespace(namespace, chainId, genesis, validators, oracles)
            if (!tx) throw new Error("Could not start the blockchain transaction")
            await tx.wait()
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    export async function setChainId(namespace: number, chainId: string, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client) {
        if (typeof namespace != "number" || namespace < 0 || namespace > 65355) return Promise.reject(new Error("Invalid namespace"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        try {
            const namespaceInstance = await gateway.getNamespacesInstance(walletOrSigner)

            const tx = await namespaceInstance.setChainId(namespace, chainId)
            if (!tx) throw new Error("Could not start the blockchain transaction")
            await tx.wait()
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    export async function setGenesis(namespace: number, genesis: string, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client) {
        if (typeof namespace != "number" || namespace < 0 || namespace > 65355) return Promise.reject(new Error("Invalid namespace"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        try {
            const namespaceInstance = await gateway.getNamespacesInstance(walletOrSigner)

            const tx = await namespaceInstance.setGenesis(namespace, genesis)
            if (!tx) throw new Error("Could not start the blockchain transaction")
            await tx.wait()
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    export async function addValidator(namespace: number, validatorPublicKey: string, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client) {
        if (typeof namespace != "number" || namespace < 0 || namespace > 65355) return Promise.reject(new Error("Invalid namespace"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        try {
            const namespaceInstance = await gateway.getNamespacesInstance(walletOrSigner)

            const tx = await namespaceInstance.addValidator(namespace, validatorPublicKey)
            if (!tx) throw new Error("Could not start the blockchain transaction")
            await tx.wait()
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    export async function removeValidator(namespace: number, index: number, validatorPublicKey: string, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client) {
        if (typeof namespace != "number" || namespace < 0 || namespace > 65355) return Promise.reject(new Error("Invalid namespace"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        try {
            const namespaceInstance = await gateway.getNamespacesInstance(walletOrSigner)

            const tx = await namespaceInstance.removeValidator(namespace, index, validatorPublicKey)
            if (!tx) throw new Error("Could not start the blockchain transaction")
            await tx.wait()
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    export async function addOracle(namespace: number, oracleAddress: string, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client) {
        if (typeof namespace != "number" || namespace < 0 || namespace > 65355) return Promise.reject(new Error("Invalid namespace"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        try {
            const namespaceInstance = await gateway.getNamespacesInstance(walletOrSigner)

            const tx = await namespaceInstance.addOracle(namespace, oracleAddress)
            if (!tx) throw new Error("Could not start the blockchain transaction")
            await tx.wait()
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    export async function removeOracle(namespace: number, index: number, oracleAddress: string, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client) {
        if (typeof namespace != "number" || namespace < 0 || namespace > 65355) return Promise.reject(new Error("Invalid namespace"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        try {
            const namespaceInstance = await gateway.getNamespacesInstance(walletOrSigner)

            const tx = await namespaceInstance.removeOracle(namespace, index, oracleAddress)
            if (!tx) throw new Error("Could not start the blockchain transaction")
            await tx.wait()
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    export async function getNamespace(namespace: number, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client): Promise<NamespaceData> {
        if (typeof namespace != "number" || namespace < 0 || namespace > 65355) return Promise.reject(new Error("Invalid namespace"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        try {
            const namespaceInstance = await gateway.getNamespacesInstance(walletOrSigner)

            const result = await namespaceInstance.getNamespace(namespace)
            if (!Array.isArray(result) || result.length != 4) throw new Error("Invalid response")

            return {
                namespace,
                chainId: result[0],
                genesis: result[1],
                validators: result[2],
                oracles: result[3]
            }
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    export async function isValidator(namespace: number, validatorPublicKey: string, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client) {
        if (typeof namespace != "number" || namespace < 0 || namespace > 65355) return Promise.reject(new Error("Invalid namespace"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        try {
            const namespaceInstance = await gateway.getNamespacesInstance(walletOrSigner)

            return namespaceInstance.isValidator(namespace, validatorPublicKey)
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    export async function isOracle(namespace: number, oracleAddress: string, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client) {
        if (typeof namespace != "number" || namespace < 0 || namespace > 65355) return Promise.reject(new Error("Invalid namespace"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        try {
            const namespaceInstance = await gateway.getNamespacesInstance(walletOrSigner)

            return namespaceInstance.isOracle(namespace, oracleAddress)
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }
}
