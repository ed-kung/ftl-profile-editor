import { DATA_PACK_SCHEMA, type DataPack } from './datapack'

/**
 * Persists the extracted data pack in IndexedDB.
 *
 * One record, overwritten each time a dat is picked. Blobs go in as Blobs --
 * IndexedDB stores them natively, so the icons never pass through base64.
 *
 * Every entry point swallows storage failures and returns null or false. A
 * private window with blocked site data should cost the user a second
 * re-selection of "ftl.dat", not an unusable page.
 */

const DB_NAME = 'ftl-profile-editor'
const DB_VERSION = 1
const STORE = 'datapack'
const KEY = 'current'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'))
  })
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadCachedDataPack(): Promise<DataPack | null> {
  try {
    const db = await openDb()
    try {
      const tx = db.transaction(STORE, 'readonly')
      const pack = await promisify<DataPack | undefined>(
        tx.objectStore(STORE).get(KEY),
      )
      // A pack from an older build lacks what this one expects, so it counts
      // as no pack and the user picks "ftl.dat" again.
      return pack?.schemaVersion === DATA_PACK_SCHEMA ? pack : null
    } finally {
      db.close()
    }
  } catch {
    return null
  }
}

/** Returns whether the pack was actually persisted. */
export async function saveCachedDataPack(pack: DataPack): Promise<boolean> {
  try {
    const db = await openDb()
    try {
      const tx = db.transaction(STORE, 'readwrite')
      await promisify(tx.objectStore(STORE).put(pack, KEY))
      return true
    } finally {
      db.close()
    }
  } catch {
    return false
  }
}

export async function clearCachedDataPack(): Promise<void> {
  try {
    const db = await openDb()
    try {
      const tx = db.transaction(STORE, 'readwrite')
      await promisify(tx.objectStore(STORE).delete(KEY))
    } finally {
      db.close()
    }
  } catch {
    // Nothing to do: a cache we cannot clear is a cache we cannot have written.
  }
}
