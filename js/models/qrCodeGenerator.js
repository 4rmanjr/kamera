/**
 * QR Code Wrapper Service
 * Menggunakan library qrcode dari npm
 */

import QRCode from 'qrcode';

export class QRCodeGenerator {
    constructor() {
        // Menggunakan library qrcode dari npm
    }

    /**
     * Generate QR code dari data lokasi
     */
    async generateLocationQRCode(location) {
        // Validasi bahwa lokasi ada dan memiliki koordinat yang valid
        if (!location) {
            console.warn('Location data is null or undefined, skipping QR code');
            return null; // Skip QR jika location tidak valid
        }

        // Periksa apakah lokasi valid (bukan 0,0 yang merupakan default)
        // Hanya anggap (0,0) sebagai tidak valid, bukan lokasi sepanjang garis khatulistiwa
        const lat = parseFloat(location.lat);
        const lng = parseFloat(location.lng);

        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
            console.warn('Location data incomplete, invalid, or at origin (0,0), skipping QR code');
            return null; // Skip QR jika location tidak valid
        }

        const mapUrl = this.generateMapUrl(lat, lng);
        return await this.createQRCode(mapUrl);
    }

    /**
     * Fungsi untuk membuat QR code menggunakan library qrcode dari npm
     */
    async createQRCode(text) {
        try {
            // Gunakan library qrcode dari npm untuk membuat data URL langsung
            const qrCodeDataUrl = await QRCode.toDataURL(text, {
                width: 300, // Ukuran QR code
                margin: 2, // Jarak antar modul
                color: {
                    dark: '#000000', // Warna modul gelap (hitam)
                    light: '#FFFFFF' // Warna modul terang (putih)
                },
                errorCorrectionLevel: 'H' // Tingkat koreksi kesalahan tertinggi
            });

            return qrCodeDataUrl;
        } catch (error) {
            console.error('Error generating QR with qrcode npm library:', error);

            // Jika library gagal, kembalikan null untuk menangani di tempat lain
            return null;
        }
    }

    /**
     * Generate URL Google Maps dari koordinat
     */
    generateMapUrl(lat, lng) {
        // Format URL yang kompatibel dengan berbagai aplikasi
        return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
}