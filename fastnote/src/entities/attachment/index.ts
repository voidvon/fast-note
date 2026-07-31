export { extractAttachmentReferences, isAttachmentHash } from './lib/attachment-references'
export {
  commitUploadedNoteAttachments,
  garbageCollectAttachments,
  getAttachmentHydrationStatus,
  hydrateRemoteAttachment,
  reconcileRemoteNoteAttachmentRefs,
  registerActiveAttachmentHash,
  registerCachedRemoteAttachment,
  removeNoteAttachmentRefs,
  resolveStoredRemoteAttachment,
  unregisterActiveAttachmentHashes,
} from './model/attachment-lifecycle-service'
export type { UploadedAttachmentMapping } from './model/attachment-lifecycle-service'
