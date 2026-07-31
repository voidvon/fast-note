export { extractAttachmentReferences, isAttachmentHash } from './lib/attachment-references'
export {
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
