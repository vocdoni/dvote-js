import { Contract } from "ethers"

import {
    EnsResolverContractMethods,
    GenesisContractMethods,
    NamespacesContractMethods,
    ProcessesContractMethods,
    ResultsContractMethods,
    Erc20StorageProofContractMethods,
} from "dvote-solidity"

export {
    EnsResolver as PublicResolverContractDefinition,
    Genesis as GenesisContractDefinition,
    Namespaces as NamespacesContractDefinition,
    Processes as ProcessesContractDefinition,
    Results as ResultsContractDefinition,
    ERC20StorageProofs as Erc20StorageProofContractDefinition,
    EnsResolverContractMethods,
    GenesisContractMethods,
    NamespacesContractMethods,
    ProcessesContractMethods,
    ResultsContractMethods,
    Erc20StorageProofContractMethods,
    ensHashAddress,

    // Interfaces
    IMethodOverrides,
    IProcessCreateParams,
    IProcessMode,
    IProcessEnvelopeType,
    IProcessCensusOrigin,
    IProcessResults,
    IProcessStatus,

    // Wrappers
    ProcessMode,
    ProcessEnvelopeType,
    ProcessCensusOrigin,
    ProcessStatus,
    ProcessResults,
    ProcessContractParameters,
} from "dvote-solidity"

export interface IEnsPublicResolverContract extends Contract, EnsResolverContractMethods { }
export interface IGenesisContract extends Contract, GenesisContractMethods { }
export interface INamespacesContract extends Contract, NamespacesContractMethods { }
export interface IProcessesContract extends Contract, ProcessesContractMethods { }
export interface IResultsContract extends Contract, ResultsContractMethods { }
export interface ITokenStorageProofContract extends Contract, Erc20StorageProofContractMethods { }
