/**
 * Event Bus Module
 * Sistem event-based untuk komunikasi antar modul tanpa ketergantungan langsung
 */

export class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe ke event tertentu
     * @param {string} event - Nama event
     * @param {function} callback - Fungsi callback yang dipanggil saat event dipicu
     */
    subscribe(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    /**
     * Unsubscribe dari event
     * @param {string} event - Nama event
     * @param {function} callback - Fungsi callback yang ingin dihapus
     */
    unsubscribe(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Emit event dengan data
     * @param {string} event - Nama event
     * @param {*} data - Data yang dikirimkan ke listener
     */
    emit(event, data = null) {
        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event ${event} listener:`, error);
                }
            });
        }
    }

    /**
     * Subscribe ke event hanya sekali
     * @param {string} event - Nama event
     * @param {function} callback - Fungsi callback
     */
    once(event, callback) {
        const onceCallback = (data) => {
            callback(data);
            this.unsubscribe(event, onceCallback);
        };
        this.subscribe(event, onceCallback);
    }
}

// Membuat instance global event bus
export const eventBus = new EventBus();