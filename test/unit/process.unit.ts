import * as nodeassert from "assert";
import { assert } from "chai";
import DvoteSmartContracts = require("dvote-smart-contracts");
import * as sinon from "sinon";
import * as dvote from "../../src";

import Web3 = require("web3");
import Web3Personal = require("web3-eth-personal");
describe("#Unit Process", () => {
    const blockchainUrl: string = "http://localhost:8545";
    const web3: Web3 = new Web3(new Web3.providers.HttpProvider(blockchainUrl));
    const web3Personal = new Web3Personal(blockchainUrl);
    let votingProcessContractAddress: string = null;
    let process: dvote.Process;

    describe("#GetById", () => {

        it("Should deploy a new VotingProcess contract", async () => {

            const accounts = await web3Personal.getAccounts();
            const organizer1 = accounts[0];
            const deployGasCost = 2600000;
            const deployGasPrice = web3.utils.toWei("1.2", "Gwei");

            const contract = new web3.eth.Contract(DvoteSmartContracts.VotingProcess.abi);
            const deployTransaction = await contract.deploy({
                data: DvoteSmartContracts.VotingProcess.bytecode,
            });

            const instance = await deployTransaction.send({
                from: organizer1,
                gas: deployGasCost,
                gasPrice: deployGasPrice,
            });

            votingProcessContractAddress = instance.options.address;
            process = new dvote.Process(blockchainUrl, votingProcessContractAddress);

            assert.isString(votingProcessContractAddress);
        });

        it("Should not accept an invalid id", () => {
            nodeassert.rejects(process.getMetadata(""), "Empty ID should fail");
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
                assert.throws(() => {
                    process.encryptVote(vote, votePublicKey);
                }, Error, "Vote can't be empty");
            }),

                it("Fails on empty votePublicKey", () => {
                    const vote: string = "1";
                    const votePublicKey: string = "";
                    assert.throws(() => {
                        process.encryptVote(vote, votePublicKey);
                    }, Error, "VotePublicKey can't be empty");
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
