/**
 * Utility Functions Module
 * Menyimpan fungsi-fungsi utilitas yang digunakan di berbagai modul
 */

import { format } from 'date-fns';
import { id } from 'date-fns/locale';

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
     * Export all settings to a JSON file
     * @param {Object} settings - The settings object to export
     */
    static exportSettings(settings) {
        // Get logo data if it exists
        const logoData = localStorage.getItem('gc_logoImg');

        // Prepare export data
        const exportData = {
            settings: { ...settings },
            logo: logoData || null,
            timestamp: new Date().toISOString(),
            version: '6.4.1'
        };

        // Convert to JSON
        const jsonString = JSON.stringify(exportData, null, 2);

        // Create a Blob and download it
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `geo-camera-settings-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Import settings from a JSON file
     * @param {File} file - The file to import settings from
     * @param {Function} callback - Callback function to handle the imported data
     */
    static importSettings(file, callback) {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);

                // Validate the imported data
                if (!importData || typeof importData !== 'object') {
                    throw new Error('Invalid settings file format');
                }

                // Validate required properties
                if (!importData.settings || typeof importData.settings !== 'object') {
                    throw new Error('Settings data is missing or invalid');
                }

                // Validate that imported settings have the expected structure
                if (!this.validateSettingsStructure(importData.settings)) {
                    throw new Error('Settings have an invalid structure');
                }

                callback(null, importData);
            } catch (error) {
                console.error('Error importing settings:', error);
                callback(error, null);
            }
        };

        reader.onerror = () => {
            callback(new Error('Failed to read the file'), null);
        };

        reader.readAsText(file);
    }

    /**
     * Validate that the settings object has the expected structure
     * @param {Object} settings - The settings object to validate
     * @returns {boolean} - Whether the settings structure is valid
     */
    static validateSettingsStructure(settings) {
        // Define the expected settings structure based on the State.settings
        const expectedStructure = {
            projName: 'string',
            projNote: 'string',
            textSize: 'string',
            textPos: 'string',
            logoPos: 'string',
            qrCodeEnabled: 'boolean', // This will be validated as a string since it's stored as string in localStorage
            qrCodePos: 'string',
            qrCodeSize: 'string'
        };

        // Check all expected keys exist in the settings object
        for (const [key, expectedType] of Object.entries(expectedStructure)) {
            if (!(key in settings)) {
                console.warn(`Missing expected setting: ${key}`);
                return false;
            }
        }

        // Additional validation for specific values
        if (typeof settings.qrCodeEnabled !== 'boolean' &&
            !(typeof settings.qrCodeEnabled === 'string' &&
              (settings.qrCodeEnabled === 'true' || settings.qrCodeEnabled === 'false'))) {
            console.warn('qrCodeEnabled has invalid value');
            return false;
        }

        // Validate text size
        if (!['s', 'm', 'l'].includes(settings.textSize)) {
            console.warn('textSize has invalid value');
            return false;
        }

        // Validate text position
        if (!['tl', 'tr', 'bl', 'br'].includes(settings.textPos)) {
            console.warn('textPos has invalid value');
            return false;
        }

        // Validate logo position
        if (!['tl', 'tr', 'bl', 'br'].includes(settings.logoPos)) {
            console.warn('logoPos has invalid value');
            return false;
        }

        // Validate QR code position
        if (!['tl', 'tr', 'bl', 'br'].includes(settings.qrCodePos)) {
            console.warn('qrCodePos has invalid value');
            return false;
        }

        // Validate QR code size
        if (!['s', 'm', 'l'].includes(settings.qrCodeSize)) {
            console.warn('qrCodeSize has invalid value');
            return false;
        }

        return true;
    }

    /**
     * Format tanggal ke locale Indonesia dengan date-fns
     * @param {Date} date - Objek tanggal
     * @returns {string} String tanggal yang diformat
     */
    static formatDate(date) {
        return format(date, 'EEEE, dd MMMM yyyy \'pukul\' HH:mm:ss', { locale: id });
    }
}

// Ekspor instance untuk konsistensi
export const UtilsInstance = new Utils();