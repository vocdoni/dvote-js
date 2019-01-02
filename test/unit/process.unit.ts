import * as nodeassert from "assert";
import { assert } from "chai";
import * as sinon from "sinon";
import * as dvote from "../../src";

describe("Process", () => {
    const blockchainUrl: string = "http://localhost:8545";
    const votingProcessContractAddress: string = "0xd8c3d0B72DFbE3adbe0fd9295c9fe083ff896684";
    let process: dvote.Process;

    beforeEach(() => {
        process = new dvote.Process(blockchainUrl, votingProcessContractAddress);
    });

    describe("#GetById", () => {
        it("Should not accept an invalid id", () => {
            nodeassert.rejects(process.getMetadata(""), "Empty ID should fail");
            // assert.isRejected(process.getMetadata(""), "Empty ID should fail");
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

            const getProcessMetadataStub = sinon.stub(dvote.Process.prototype, "getMetadata")
                .resolves(expectedProcessMetadata);

            const metadata: object = await process.getMetadata("identifier");

            getProcessMetadataStub.restore();
            sinon.assert.match(metadata, expectedProcessMetadata);
        });
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
