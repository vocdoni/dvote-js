import { WalletBackup } from "../models/protobuf"

export function serializeWalletBackup(data: WalletBackup): Uint8Array {
    return WalletBackup.encode(data).finish()
}

export function deserializeWalletBackup(bytes: Uint8Array): WalletBackup {
    return WalletBackup.decode(bytes)
}
