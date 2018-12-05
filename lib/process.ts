import Blockchain from "./blockchain";

export default class Process {
    constructor(){
    }

    static getMetadata(id) {
        return Blockchain.getProcessMetadata(id);
    }

    static encryptVote(vote, votePublicKey):boolean {
        return false;
    }
}