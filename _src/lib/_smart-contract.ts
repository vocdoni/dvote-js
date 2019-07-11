import { Contract, ContractFactory, providers, getDefaultProvider, Wallet, Signer } from "ethers"

type ConstructorParams = {
    // contract
    abi: any[]
    bytecode: string,

    // connectivity
    web3Provider?: providers.Web3Provider,  // for window.web3.currentProvider
    providerUrl?: string,                   // URL's like http://localhost:8545
    provider?: providers.Provider,          // specific ethers.js provider

    // wallet
    privateKey?: string,
    mnemonic?: string,
    mnemonicPath?: string                   // Derivation path
}

/**
 * The class serves as the foundation for deploying and attaching to 
 * Smart Contracts
 */
export default abstract class SmartContract<CustomContractMethods> {
    abi: any[]
    bytecode: string

    provider: providers.Provider
    wallet: Wallet | Signer

    contractInstance: (Contract & CustomContractMethods)

    constructor(params: ConstructorParams) {
        if (!params) throw new Error("Invalid parameters")

        const { abi, bytecode, web3Provider, providerUrl, provider, privateKey, mnemonic, mnemonicPath } = params
        if (!abi) throw new Error("Invalid ABI")
        else if (!bytecode) throw new Error("Invalid bytecode")

        if (web3Provider) {
            // metamask scenario > wallets should be available there
            let provider = new providers.Web3Provider(web3Provider)
            this.provider = provider
            this.wallet = provider.getSigner()
        }
        else {
            if (providerUrl) {
                this.provider = new providers.JsonRpcProvider(providerUrl)
            }
            else if (provider) {
                // specific ethers.js provider
                this.provider = provider
            }
            else {
                // Mainnet as a read-only fallback
                this.provider = getDefaultProvider()
            }

            // We handle the wallets ourselves
            if (mnemonic) {
                this.wallet = Wallet.fromMnemonic(mnemonic, mnemonicPath || "m/44'/60'/0'/0/0")
                    .connect(this.provider)
            }
            else if (privateKey) {
                this.wallet = new Wallet(privateKey, this.provider)
            }
        }

        this.abi = abi
        this.bytecode = bytecode
        this.contractInstance = null
    }

    /**
     * Deploy the contract using the current provider and wallet
     */
    async deploy(): Promise<(Contract & CustomContractMethods)> {
        if (!this.wallet) throw new Error("You need to provide a private key, a mnemonic or a web3 provider with an account to deploy a contract")

        const contractFactory = new ContractFactory(this.abi, this.bytecode, this.wallet)
        this.contractInstance = (await contractFactory.deploy()) as (Contract & CustomContractMethods)

        return this.contractInstance
    }

    /**
     * Use the contract instance at the given address
     * @param address Contract instance address
     * @return A contract instance attached to the given address
     */
    attach(address: string): (Contract & CustomContractMethods) {
        this.contractInstance = new Contract(address, this.abi, this.provider) as (Contract & CustomContractMethods)
        if (this.wallet) this.contractInstance = this.contractInstance.connect(this.wallet) as (Contract & CustomContractMethods)

        return this.contractInstance
    }

    /**
     * Return the current contract instance
     */
    deployed(): (Contract & CustomContractMethods) {
        if (!this.contractInstance) throw new Error("Please, attach to an instance or deploy one")

        return this.contractInstance
    }

    /**
     * Use the given provider to connect to the blockchain.
     * @param provider
     */
    setProvider(provider: providers.Provider): (Contract & CustomContractMethods) {
        if (!provider) throw new Error("The provider is required")
        this.contractInstance = this.contractInstance.connect(provider) as (Contract & CustomContractMethods)
        this.provider = provider

        return this.contractInstance
    }

    /**
     * Use the given signer to sign transactions.
     * @param params An object containing the provider and/or signer to use
     */
    setSigner(signer: Signer): (Contract & CustomContractMethods) {
        if (!signer) throw new Error("A signer/wallet is required")

        this.contractInstance = this.contractInstance.connect(signer) as (Contract & CustomContractMethods)
        this.wallet = signer

        return this.contractInstance
    }
}
