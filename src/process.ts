import Blockchain from "./blockchain";

export default class Process {
    public static getMetadata(id: number): object {
        return Blockchain.getProcessMetadata(id);
    }

    public static encryptVote(vote: string, votePublicKey: string): string {
        if (vote.length === 0) {
            throw Error("Vote can't be empty");
        }

        if (votePublicKey.length === 0) {
            throw Error("VotePublicKey can't be empty");
        }

        return "";
    }
}
