import { openDB, type IDBPDatabase } from 'idb'
import type { PasskeyCredential } from './types'

const DB_NAME = 'facewallet'
const DB_VERSION = 1
const STORE_NAME = 'credentials'

export class PasskeyStorage {
  private dbPromise: Promise<IDBPDatabase>

  constructor() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'credentialId',
          })
          store.createIndex('address', 'address', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }
      },
    })
  }

  async saveCredential(credential: PasskeyCredential): Promise<void> {
    try {
      const db = await this.dbPromise
      await db.put(STORE_NAME, credential)
    } catch (error) {
      throw new Error(`Failed to save credential: ${error}`)
    }
  }

  async getCredential(credentialId: string): Promise<PasskeyCredential | null> {
    try {
      const db = await this.dbPromise
      const credential = await db.get(STORE_NAME, credentialId)
      return credential || null
    } catch (error) {
      throw new Error(`Failed to get credential: ${error}`)
    }
  }

  async getCredentialByAddress(
    address: string
  ): Promise<PasskeyCredential | null> {
    try {
      const db = await this.dbPromise
      const index = db.transaction(STORE_NAME).store.index('address')
      const credential = await index.get(address)
      return credential || null
    } catch (error) {
      throw new Error(`Failed to get credential by address: ${error}`)
    }
  }

  async getAllCredentials(): Promise<PasskeyCredential[]> {
    try {
      const db = await this.dbPromise
      return db.getAll(STORE_NAME)
    } catch (error) {
      throw new Error(`Failed to get all credentials: ${error}`)
    }
  }

  async deleteCredential(credentialId: string): Promise<void> {
    try {
      const db = await this.dbPromise
      await db.delete(STORE_NAME, credentialId)
    } catch (error) {
      throw new Error(`Failed to delete credential: ${error}`)
    }
  }

  async clearAll(): Promise<void> {
    try {
      const db = await this.dbPromise
      await db.clear(STORE_NAME)
    } catch (error) {
      throw new Error(`Failed to clear all credentials: ${error}`)
    }
  }
}
