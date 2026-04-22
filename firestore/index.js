import { FirestorePaginate } from "./paginate.js";
import { FirestoreTTL } from "./ttl.js";
import { FirestoreOffline } from "./offline.js";

/**
 * `mb.firestore` — optimization helpers that apply to Multibase's own
 * Firestore reads and writes. Pagination, TTL, and offline persistence.
 */
export class FirestoreModule {
  constructor(multibase) {
    this.multibase = multibase;
    this.paginate = new FirestorePaginate(multibase);
    this.ttl = new FirestoreTTL(multibase);
    this.offline = new FirestoreOffline(multibase);
  }
}

export { FirestorePaginate, FirestoreTTL, FirestoreOffline };
