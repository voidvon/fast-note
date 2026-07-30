export { extractAttachmentReferences, isAttachmentHash } from './lib/attachment-references'
export {
  garbageCollectAttachments,
  getAttachmentHydrationStatus,
  hydrateRemoteAttachment,
  reconcileRemoteNoteAttachments,
  registerActiveAttachmentHash,
  removeNoteAttachmentRefs,
  resolveStoredRemoteAttachment,
  unregisterActiveAttachmentHashes,
} from './model/attachment-lifecycle-service'
