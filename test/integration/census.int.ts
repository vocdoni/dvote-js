import { assert } from "chai";
import Web3 = require("web3");
import * as dvote from "../../src";
import * as sinon from "sinon";
import MerkleProof from "../../src/dvote/merkleProof";

import Config from "../../src/dvote/utils/config";
const HDWalletProvider = require("truffle-hdwallet-provider");


describe("Census", () => {

    const mnemonic: string = Config.MNEMONIC
    const blockchainUrl: string = Config.BLOCKCHAIN_URL;
    const httpProvider = new HDWalletProvider(mnemonic, blockchainUrl, 0, 10);    
    const web3 = new Web3(httpProvider); 
    
    const censusServiceUrl: string = Config.CENSUS_SERVICE_URL;
    const censusPrivateKey: string = Config.CENSUS_PRIVATE_KEY;

    let accounts = [];

    let census: dvote.Census;
    const censusId = "test_" + Math.floor(Math.random() * 1000000000);

    before(async () => {
        accounts = await web3.eth.getAccounts();

        census = new dvote.Census();
        census.initCensusService(censusServiceUrl);
    });

    describe("Should be able to add a public key to a census and verify it's inside using the proof", () => {
        let proof: MerkleProof = null;

        it("Should add the claim to the census", async () => {
            const response = await census.addClaim(accounts[0], censusId, censusPrivateKey);
            assert.isTrue(response);
        });

        it("Should not be able to add a mal-signed claim to the census", async () => {
            const censusSignStub = sinon.stub(dvote.Census.prototype, "sign")
                                        .returns("this_is_not_a_correct_signature");

            const response = await census.addClaim(accounts[0], censusId, censusPrivateKey);

            censusSignStub.restore();

            assert.isFalse(response);
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

        it("Should take a snapshot of the census, get the proof but not add new claim to this censusID", async () => {
            const snapshotCensusId = await census.snapshot(censusId, censusPrivateKey);
            assert.isString(snapshotCensusId, "snapshotCensusId provided by snapshot should be a string");

            proof = await census.getProof(accounts[0], snapshotCensusId);
            assert.isString(proof.raw, "Raw proof should be a string");

            const response = await census.checkProof(accounts[0], snapshotCensusId, proof.raw);
            assert.isTrue(response, "A valid response verifies Public Key is in Census");

            const res = await census.addClaim(accounts[1], snapshotCensusId, censusPrivateKey);
            assert.isFalse(res, "Shouldn't be able to add a Claim in a snapshoted census");

            const dump = await census.dump(censusId);
            assert.isArray(dump);
        });

    });

});
