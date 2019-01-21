import { assert } from "chai";
import Web3Personal = require("web3-eth-personal");
import * as dvote from "../../src";
import MerkleProof from "../../src/dvote/merkleProof";

import Config from "../../src/dvote/utils/config";

describe("Census", () => {
    const blockchainUrl: string = Config.BLOCKCHAIN_URL;
    const censusServiceUrl: string = Config.CENSUS_SERVICE_URL;
    const censusPrivateKey: string = Config.CENSUS_PRIVATE_KEY;
    const web3Personal = new Web3Personal(blockchainUrl);

    let accounts = [];

    let census: dvote.Census;
    const censusId = "test_" + Math.floor(Math.random() * 1000000000);

    before(async () => {
        accounts = await web3Personal.getAccounts();

        census = new dvote.Census();
        census.initCensusService(censusServiceUrl);
    });

    describe("Should be able to add a public key to a census and verify it's inside using the proof", () => {
        let proof: MerkleProof = null;

        it("Should add the claim to the census", async () => {
            const response = await census.addClaim(accounts[0], censusId, censusPrivateKey);
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

        it("Should get the Root of the census", async () => {
            const response = await census.getRoot(censusId);
            assert.isString(response, "Census Root should be a string");
        });
    });

});
