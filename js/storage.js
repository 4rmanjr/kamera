/**
 * Storage Service Module
 * Mengelola operasi penyimpanan menggunakan IndexedDB dan localStorage
 */

export class StorageService {
    constructor({ state, dom, eventBus }) {
        this.state = state;
        this.dom = dom;
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
                this.loadLastThumb();
                resolve();
            };
            req.onerror = (e) => {
                console.error("DB Error", e);
                reject(e);
            };
        });
    }

    savePhoto(dataUrl, callback) {
        if (!this.state.db) return;
        const tx = this.state.db.transaction([this.STORE], 'readwrite');
        tx.objectStore(this.STORE).add({ data: dataUrl, date: new Date().toISOString() });
        tx.oncomplete = () => {
            this.loadLastThumb();
            if (callback) callback();
            // Emit event bahwa foto telah disimpan
            this.eventBus.emit('photo:saved', { dataUrl });
        };
    }

    getAll(cb) {
        if (!this.state.db) return;
        const tx = this.state.db.transaction([this.STORE], 'readonly');
        const req = tx.objectStore(this.STORE).getAll();
        req.onsuccess = () => cb(req.result.sort((a, b) => new Date(b.date) - new Date(a.date)));
    }

    delete(id, cb) {
        const tx = this.state.db.transaction([this.STORE], 'readwrite');
        tx.objectStore(this.STORE).delete(id);
        tx.oncomplete = () => {
            if (cb) cb();
            this.eventBus.emit('photo:deleted', { id });
        };
    }

    clearAll(cb) {
        const tx = this.state.db.transaction([this.STORE], 'readwrite');
        tx.objectStore(this.STORE).clear();
        tx.oncomplete = () => {
            if (cb) cb();
            this.eventBus.emit('gallery:cleared');
        };
    }

    loadLastThumb() {
        this.getAll((photos) => {
            if (photos.length > 0) {
                if(this.dom.imgThumb && this.dom.iconGallery) {
                    this.dom.imgThumb.src = photos[0].data;
                    this.dom.imgThumb.classList.remove('hidden');
                    this.dom.iconGallery.classList.add('hidden');
                }
            } else {
                if(this.dom.imgThumb && this.dom.iconGallery) {
                    this.dom.imgThumb.classList.add('hidden');
                    this.dom.iconGallery.classList.remove('hidden');
                }
            }
        });
    }

    saveSetting(key, val) {
        this.state.settings[key] = val;
        localStorage.setItem(`gc_${key}`, val);
    }
}