import { assert } from "chai";
import Web3 = require("web3");
import Web3Personal = require("web3-eth-personal");
import * as dvote from "../../src";
import MerkleProof from "../../src/dvote/merkleProof";

import DvoteSmartContracts = require("dvote-smart-contracts");
import { deployContract } from "../testUtils";

describe("Census", () => {
    const blockchainUrl: string = process.env.BLOCKCHAIN_URL;
    const censusServiceUrl: string = process.env.CENSUS_SERVICE_URL;
    const web3Personal = new Web3Personal(blockchainUrl);
    let votingEntityContractAddress: string = null;
    let census: dvote.Census;
    let accounts = [];
    const censusId = "test_" + Math.floor(Math.random() * 1000000000);

    before(async () => {
        accounts = await web3Personal.getAccounts();

        votingEntityContractAddress = await deployContract(
            new Web3(new Web3.providers.HttpProvider(blockchainUrl)),
            DvoteSmartContracts.VotingEntity.abi,
            DvoteSmartContracts.VotingEntity.bytecode,
            accounts[0],
            3500000,
            Web3.utils.toWei("1.2", "Gwei"),
        );

        census = new dvote.Census(blockchainUrl, votingEntityContractAddress, censusServiceUrl);
    });

    describe("Should be able to add a public key to a census and verify it's inside using the proof", () => {
        let proof: MerkleProof = null;

        it("Should add the claim to the census", async () => {
            const response = await census.addClaim(accounts[0], censusId);
            assert.isTrue(response);
        });

        it("Should get the proof from the census", async () => {
            proof = await census.getProof(accounts[0], censusId);
            assert.isString(proof.raw, "Raw proof should be a string");
        });

        it("Should verify the provided census proof", async () => {
            const response = await census.checkProof(accounts[0], censusId, proof.raw);
            assert.isTrue(response, "A valid response verifies Public Key is in Census");
        });
    });

});
