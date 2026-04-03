
export class VoteDB {
  private dbName = 'OneCoreVotes';
  private storeName = 'votes';
  private sigStoreName = 'signatures';
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2);
      request.onupgradeneeded = (event: any) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.sigStoreName)) {
          db.createObjectStore(this.sigStoreName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveSignature(lib: string, offset: string, pattern: string) {
    if (!this.db) await this.init();
    const id = `${lib}_${offset}`;
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.sigStoreName, 'readwrite');
      const store = transaction.objectStore(this.sigStoreName);
      store.put({ id, lib, offset, pattern, timestamp: Date.now() });
      transaction.oncomplete = () => resolve(true);
    });
  }

  async getAllSignatures(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.sigStoreName, 'readonly');
      const store = transaction.objectStore(this.sigStoreName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getVote(id: string): Promise<{ up: number; down: number } | null> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || { up: 0, down: 0 });
    });
  }

  async saveVote(id: string, type: 'up' | 'down') {
    if (!this.db) await this.init();
    const current = await this.getVote(id) || { up: 0, down: 0 };
    if (type === 'up') current.up++;
    else current.down++;
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      store.put({ id, ...current });
      transaction.oncomplete = () => resolve(true);
    });
  }

  async getAllVotes(): Promise<Record<string, { up: number; down: number }>> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        const results: Record<string, { up: number; down: number }> = {};
        request.result.forEach((item: any) => {
          results[item.id] = { up: item.up, down: item.down };
        });
        resolve(results);
      };
    });
  }
}
