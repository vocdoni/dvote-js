import {assert} from "chai";
import * as sinon from "sinon";

import Blockchain from "../../src/blockchain";
import Process from "../../src/process";

describe("Process", () => {
    const blockchainUrl: string = "http://localhost:8545";
    const votingProcessContractPath: string = "/contracts/VotingProcess.json";
    const votingProcessContractAddress: string = "0xd8c3d0B72DFbE3adbe0fd9295c9fe083ff896684";
    let process: Process;

    beforeEach(() => {
        const getVotingProcessAbi = sinon.stub(Blockchain.prototype, "getVotingProcessContractAbi")
                                         .returns([{}]);
        process = new Process(blockchainUrl, votingProcessContractPath, votingProcessContractAddress);
        getVotingProcessAbi.restore();
    });

    describe("#GetById", () => {
        it("Should not accept an invalid id", () => {
            assert.throws(() => { process.getMetadata(""); }, Error, "ID can't be empty");
        });

        it("Should return a valid process Metadata", async () => {
            const expectedProcessMetadata = {
                censusRoot: "",
                censusUrl: "",
                endBlock: "",
                startBlock: "",
                status: "",
                trustedGateways: "",
                voteEncryptionKeys: "",
                votingOptions: "",
            };

            const getProcessMetadataStub = sinon.stub(Blockchain.prototype, "getProcessMetadata")
                                                .resolves(expectedProcessMetadata);

            const metadata: object = await process.getMetadata("identifier");

            getProcessMetadataStub.restore();
            sinon.assert.match(metadata, expectedProcessMetadata);
        });
    }),

    describe("#getOpen", () => {
        it("");
    }),

    describe("#getRelays", () => {
        it("");
    }),

    describe("#batchExists", () => {
        it("");
    }),

    describe("#getVotingOptions", () => {
        it("");
    }),

    describe("#encryptVote", () => {
        it("Fails on empty vote", () => {
            const vote: string = "";
            const votePublicKey: string = "123abcdeb";
            assert.throws(() => { process.encryptVote(vote, votePublicKey); }, Error, "Vote can't be empty");
        }),

        it("Fails on empty votePublicKey", () => {
            const vote: string = "1";
            const votePublicKey: string = "";
            assert.throws(() => { process.encryptVote(vote, votePublicKey); }, Error, "VotePublicKey can't be empty");
        }),

        it("Result is a String", () => {
            const vote: string = "1";
            const votePublicKey: string = "123abcdeb";
            const encryptedVote: string = process.encryptVote(vote, votePublicKey);
            assert.isString(encryptedVote);
        });
    }),

    describe("#hashEncryptedVote", () => {
        it("");
    }),

    describe("#getVotingPackage", () => {
        it("");
    });
});
