/**
 * Storage Service Module
 * Mengelola operasi penyimpanan menggunakan IndexedDB dan localStorage
 */

export class StorageService {
    constructor({ state, dom, eventBus }) {
        this.state = state;
        this.dom = dom; // DOM masih diperlukan untuk referensi di UI controller, tapi tidak digunakan di sini
        this.eventBus = eventBus;
        this.DB_NAME = 'GeoCamDB_v6_4';
        this.STORE = 'photos';
    }

    init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE)) {
                    db.createObjectStore(this.STORE, { keyPath: 'id', autoIncrement: true });
                }
            };
            req.onsuccess = (e) => {
                this.state.db = e.target.result;
                // Emit event to notify that the storage is ready
                this.eventBus.emit('storage:initialized');
                resolve();
            };
            req.onerror = (e) => {
                console.error("DB Error", e);
                reject(e);
            };
        });
    }

    savePhoto(dataUrl) {
        return new Promise((resolve, reject) => {
            if (!this.state.db) return reject("Database not initialized");
            const tx = this.state.db.transaction([this.STORE], 'readwrite');
            const request = tx.objectStore(this.STORE).add({ data: dataUrl, date: new Date().toISOString() });

            tx.oncomplete = () => {
                this.eventBus.emit('photo:saved', { dataUrl });
                resolve();
            };
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    getAll() {
        return new Promise((resolve, reject) => {
            if (!this.state.db) return reject("Database not initialized");
            const tx = this.state.db.transaction([this.STORE], 'readonly');
            const req = tx.objectStore(this.STORE).getAll();
            req.onsuccess = () => {
                const sortedPhotos = req.result.sort((a, b) => new Date(b.date) - new Date(a.date));
                resolve(sortedPhotos);
            };
            req.onerror = (event) => reject(event.target.error);
        });
    }

    delete(id) {
        return new Promise((resolve, reject) => {
            if (!this.state.db) return reject("Database not initialized");
            const tx = this.state.db.transaction([this.STORE], 'readwrite');
            tx.objectStore(this.STORE).delete(id);
            tx.oncomplete = () => {
                this.eventBus.emit('photo:deleted', { id });
                resolve();
            };
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    clearAll() {
        return new Promise((resolve, reject) => {
            if (!this.state.db) return reject("Database not initialized");
            const tx = this.state.db.transaction([this.STORE], 'readwrite');
            tx.objectStore(this.STORE).clear();
            tx.oncomplete = () => {
                this.eventBus.emit('gallery:cleared');
                resolve();
            };
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    getLastPhoto() {
        return new Promise((resolve, reject) => {
            this.getAll()
                .then(photos => {
                    if (photos.length > 0) {
                        resolve(photos[0]);
                    } else {
                        resolve(null);
                    }
                })
                .catch(reject);
        });
    }

    saveSetting(key, val) {
        this.state.settings[key] = val;
        localStorage.setItem(`gc_${key}`, val);
    }
}