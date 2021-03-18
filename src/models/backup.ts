import { BackupLink } from "../models/protobuf"

export function serializeBackupLink(data: BackupLink): Uint8Array {
    return BackupLink.encode(data).finish()
}

export function deserializeBackupLink(bytes: Uint8Array): BackupLink {
    return BackupLink.decode(bytes)
}
