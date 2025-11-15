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
     * Fungsi untuk membuat QR code menggunakan library qrcodejs secara langsung dengan canvas
     */
    async createQRCode(text) {
        try {
            // Gunakan library qrcodejs yang tersedia secara lokal
            if (typeof QRCode !== 'undefined') {
                // Buat div sementara untuk digunakan oleh library qrcodejs
                const tempDiv = document.createElement('div');

                // Buat QR code instance dengan level koreksi tertinggi
                const qr = new QRCode(tempDiv, {
                    text: text,
                    width: 200,  // Ukuran QR code
                    height: 200, // Ukuran QR code
                    colorDark: "#000000",  // Warna modul gelap (hitam)
                    colorLight: "#FFFFFF", // Warna modul terang (putih)
                    correctLevel: QRCode.CorrectLevel.H // Tingkat koreksi kesalahan tertinggi
                });

                // Generate QR code
                qr.makeCode(text);

                // Tunggu sebentar agar gambar selesai dirender
                await new Promise(resolve => setTimeout(resolve, 50));

                // Konversi SVG atau elemen HTML ke canvas
                const svgElement = tempDiv.querySelector('svg');
                if (svgElement) {
                    // Jika output dalam bentuk SVG
                    return this.convertSVGToDataURL(svgElement, 300);
                } else {
                    // Jika output dalam bentuk canvas langsung
                    const canvasElement = tempDiv.querySelector('canvas');
                    if (canvasElement) {
                        return canvasElement.toDataURL('image/png', 1.0);
                    } else {
                        // Jika tidak ada SVG maupun canvas, buat dari tabel
                        return this.createCanvasFromTable(tempDiv, 300);
                    }
                }
            } else {
                console.warn('QRCode library not available, using fallback');
                return this.createDefaultQR(text);
            }
        } catch (error) {
            console.error('Error generating QR with qrcodejs:', error);

            // Coba metode alternatif jika metode utama gagal
            try {
                // Buat QR code instance tanpa DOM langsung
                const qr = new QRCode(10, QRCode.CorrectLevel.H);
                qr.addData(text);
                qr.make();

                // Buat canvas dengan ukuran yang cukup besar untuk kualitas tinggi
                const canvasSize = 300; // Ukuran canvas yang diinginkan
                const canvas = document.createElement('canvas');
                canvas.width = canvasSize;
                canvas.height = canvasSize;
                const ctx = canvas.getContext('2d');

                // Hitung ukuran modul QR
                const modulesCount = qr.getModuleCount();

                // Tambahkan quiet zone standar sebesar 4 modul di sekelilingnya
                const quietZone = 4;
                const totalSize = modulesCount + 2 * quietZone;

                // Ukuran tiap modul
                const moduleSize = Math.floor(canvasSize / totalSize);

                // Hitung posisi awal agar QR code terpusat
                const startX = Math.floor((canvasSize - (modulesCount * moduleSize)) / 2);
                const startY = Math.floor((canvasSize - (modulesCount * moduleSize)) / 2);

                // Gambar background putih (penting untuk QR code sesuai standar)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvasSize, canvasSize);

                // Gambar setiap modul QR dengan warna hitam
                ctx.fillStyle = '#000000';
                for (let row = 0; row < modulesCount; row++) {
                    for (let col = 0; col < modulesCount; col++) {
                        if (qr.isDark(row, col)) {
                            const x = startX + ((col + quietZone) * moduleSize);
                            const y = startY + ((row + quietZone) * moduleSize);

                            // Gambar kotak modul
                            ctx.fillRect(x, y, moduleSize, moduleSize);
                        }
                    }
                }

                return canvas.toDataURL('image/png', 1.0);
            } catch (fallbackError) {
                console.error('QR fallback method also failed:', fallbackError);
                // Jika semua metode gagal, gunakan fallback default
                return this.createDefaultQR(text);
            }
        }
    }

    /**
     * Fungsi untuk mengonversi SVG ke data URL
     */
    convertSVGToDataURL(svgElement, size) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);

            const img = new Image();
            img.onload = () => {
                // Gambar background putih dulu
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, size, size);

                // Gambar SVG ke dalam canvas
                ctx.drawImage(img, 0, 0, size, size);

                // Bebaskan URL objek
                URL.revokeObjectURL(svgUrl);

                resolve(canvas.toDataURL('image/png', 1.0));
            };

            img.onerror = () => {
                // Jika gagal, kembalikan fallback
                URL.revokeObjectURL(svgUrl);
                resolve(this.createDefaultQR("Failed to load SVG"));
            };

            img.src = svgUrl;
        });
    }

    /**
     * Fungsi untuk membuat canvas dari elemen tabel
     */
    createCanvasFromTable(divElement, size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Cari tabel QR code
        const table = divElement.querySelector('table');
        if (!table) {
            return this.createDefaultQR("No table found");
        }

        // Dapatkan ukuran tabel
        const rows = table.querySelectorAll('tr');
        const modulesCount = rows.length;

        if (modulesCount === 0) {
            return this.createDefaultQR("Empty table");
        }

        // Ukuran tiap modul
        const moduleSize = Math.floor(size / modulesCount);

        // Gambar background putih
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, size, size);

        // Iterasi setiap sel dalam tabel
        for (let row = 0; row < modulesCount; row++) {
            const cells = rows[row].querySelectorAll('td');
            for (let col = 0; col < modulesCount; col++) {
                if (cells[col]) {
                    // Dapatkan warna latar belakang sel
                    const bgColor = window.getComputedStyle(cells[col]).backgroundColor;
                    // Jika warna gelap (hitam/abu-abu gelap), gambar kotak hitam
                    if (bgColor && (bgColor.includes('0, 0, 0') || bgColor.includes('0,0,0') || bgColor.includes('33, 33, 33'))) {
                        ctx.fillStyle = 'black';
                        ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
                    }
                }
            }
        }

        return canvas.toDataURL('image/png', 1.0);
    }

    /**
     * Fungsi untuk membuat QR default jika library gagal - gambar teks URL sebagai fallback
     */
    async createDefaultQR(defaultText) {
        // Gunakan fallback yang lebih representatif dari sebelumnya
        const canvas = document.createElement('canvas');
        const size = 300;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Background putih
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, size, size);

        // Gambar struktur QR sederhana agar lebih representatif
        this.drawSimpleQR(ctx, size);

        // Tambahkan URL sebagai teks di tengah
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        const lines = defaultText.match(/.{1,30}/g) || [defaultText];
        lines.forEach((line, i) => {
            ctx.fillText(line, size/2, size/2 + (i * 15));
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