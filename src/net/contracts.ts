import { Contract } from "ethers"

import {
    EnsPublicResolverContractMethods,
    NamespaceContractMethods,
    TokenStorageProofContractMethods,
    ProcessContractMethods
} from "dvote-solidity"

export {
    EnsPublicResolver as PublicResolverContractDefinition,
    Namespace as NamespacesContractDefinition,
    TokenStorageProof as TokenStorageProofContractDefinition,
    Process as ProcessesContractDefinition,
    EnsPublicResolverContractMethods,
    NamespaceContractMethods,
    TokenStorageProofContractMethods,
    ProcessContractMethods,
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

export interface IEnsPublicResolverContract extends Contract, EnsPublicResolverContractMethods { }
export interface INamespaceContract extends Contract, NamespaceContractMethods { }
export interface ITokenStorageProofContract extends Contract, TokenStorageProofContractMethods { }
export interface IProcessContract extends Contract, ProcessContractMethods { }
