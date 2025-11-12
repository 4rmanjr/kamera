/**
 * QR Code Wrapper Service
 * Menggunakan library qrcode.js yang tersedia secara global
 */

export class QRCodeGenerator {
    constructor() {
        // Menggunakan QRious library
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
     * Fungsi untuk membuat QR code menggunakan library qrcode global
     */
    async createQRCode(text) {
        try {
            // Gunakan QR Server API sebagai fallback utama
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('QR Server API failed');
            }
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Error generating QR with API:', error);

            // Gunakan fallback local jika API gagal
            return this.createDefaultQR(text);
        }
    }

    /**
     * Fungsi untuk membuat QR default jika library gagal - gambar teks URL sebagai fallback
     */
    async createDefaultQR(defaultText) {
        const canvas = document.createElement('canvas');
        const size = 300;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Background putih
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, size, size);

        // Gambar teks URL
        ctx.fillStyle = 'black';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        const lines = defaultText.match(/.{1,20}/g) || [defaultText];
        lines.forEach((line, i) => {
            ctx.fillText(line, size/2, size/2 + (i * 20));
        });

        return canvas.toDataURL('image/png');
    }

    /**
     * Gambar struktur QR sederhana
     */
    drawSimpleQR(ctx, size) {
        const moduleSize = Math.max(2, Math.floor(size / 25));

        // Gambar posisi markers
        this.drawPositionMarker(ctx, 0, 0, moduleSize);
        this.drawPositionMarker(ctx, size - 7 * moduleSize, 0, moduleSize);
        this.drawPositionMarker(ctx, 0, size - 7 * moduleSize, moduleSize);

        // Gambar timing patterns
        this.drawTimingPattern(ctx, moduleSize, size);

        // Gambar beberapa data pattern
        this.drawDataPattern(ctx, moduleSize, size);
    }

    drawPositionMarker(ctx, x, y, moduleSize) {
        ctx.fillStyle = 'black';
        // Outer square
        ctx.fillRect(x, y, 7 * moduleSize, 7 * moduleSize);
        // Inner square
        ctx.fillStyle = 'white';
        ctx.fillRect(x + moduleSize, y + moduleSize, 5 * moduleSize, 5 * moduleSize);
        // Even more inner square
        ctx.fillStyle = 'black';
        ctx.fillRect(x + 2 * moduleSize, y + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize);
    }

    drawTimingPattern(ctx, moduleSize, size) {
        ctx.fillStyle = 'black';
        // Horizontal timing pattern
        for (let i = 8; i < (size / moduleSize) - 8; i++) {
            if (i % 2 === 0) {
                ctx.fillRect(i * moduleSize, 6 * moduleSize, moduleSize, moduleSize);
            }
        }
        // Vertical timing pattern
        for (let j = 8; j < (size / moduleSize) - 8; j++) {
            if (j % 2 === 0) {
                ctx.fillRect(6 * moduleSize, j * moduleSize, moduleSize, moduleSize);
            }
        }
    }

    drawDataPattern(ctx, moduleSize, size) {
        ctx.fillStyle = 'black';
        const start = 9; // Mulai setelah posisi markers
        const end = Math.floor(size / moduleSize) - 8;

        // Gambar pattern data sederhana
        for (let row = start; row < end; row++) {
            for (let col = start; col < end; col++) {
                // Hindari area penting seperti posisi markers
                if ((row < 10 && col < 10) ||
                    (row < 10 && col > end - 10) ||
                    (row > end - 10 && col < 10)) {
                    continue;
                }

                // Pola berdasarkan posisi untuk distribusi acak
                if (((row + col) % 3) === 0) {
                    const x = col * moduleSize;
                    const y = row * moduleSize;
                    ctx.fillRect(x, y, moduleSize, moduleSize);
                }
            }
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