/**
 * Utility Functions Module
 * Menyimpan fungsi-fungsi utilitas yang digunakan di berbagai modul
 */

export class Utils {
    /**
     * Fungsi untuk memperbarui settings
     * @param {Object} settings - Objek settings
     * @param {string} key - Kunci pengaturan
     * @param {any} value - Nilai pengaturan
     */
    static updateSetting(settings, key, value) {
        settings[key] = value;
        // Untuk boolean values, simpan sebagai string "true"/"false"
        const stringValue = typeof value === 'boolean' ? String(value) : value;
        localStorage.setItem(`gc_${key}`, stringValue);
    }

    /**
     * Format tanggal ke locale Indonesia
     * @param {Date} date - Objek tanggal
     * @returns {string} String tanggal yang diformat
     */
    static formatDate(date) {
        return date.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' });
    }
}

// Ekspor instance untuk konsistensi
export const UtilsInstance = new Utils();