/**
 * Canvas Processor Module
 * Mengelola pengolahan gambar menggunakan canvas dengan optimasi kinerja
 */

export class CanvasProcessorService {
    constructor({ state, dom, eventBus, qrCodeGenerator }) {
        this.state = state;
        this.dom = dom;
        this.eventBus = eventBus;
        this.qrCodeGenerator = qrCodeGenerator;
        // Batas maksimum dimensi canvas untuk optimasi
        this.maxCanvasWidth = 1920;
        this.maxCanvasHeight = 1080;
    }

    async capture() {
        const vid = this.dom.video;
        const cvs = this.dom.canvas;
        
        // Check if required DOM elements exist
        if (!vid || !cvs) {
            console.error('Video or canvas element not found for capture');
            return;
        }
        
        const ctx = cvs.getContext('2d');
        if (!ctx) {
            console.error('Unable to get canvas context for capture');
            return;
        }

        // Optimasi ukuran canvas untuk kinerja
        let canvasWidth = vid.videoWidth;
        let canvasHeight = vid.videoHeight;

        // Batasi ukuran maksimum canvas untuk kinerja
        if (canvasWidth > this.maxCanvasWidth) {
            const ratio = this.maxCanvasWidth / canvasWidth;
            canvasWidth = this.maxCanvasWidth;
            canvasHeight = canvasHeight * ratio;
        }

        if (canvasHeight > this.maxCanvasHeight) {
            const ratio = this.maxCanvasHeight / canvasHeight;
            canvasHeight = this.maxCanvasHeight;
            canvasWidth = canvasWidth * ratio;
        }

        cvs.width = canvasWidth;
        cvs.height = canvasHeight;

        // Gambar video ke canvas dengan transformasi
        ctx.save();
        if (this.state.facingMode === 'user') {
            ctx.translate(canvasWidth, 0);
            ctx.scale(-1, 1);
        }

        // Gunakan drawImage dengan ukuran yang dioptimalkan
        ctx.drawImage(vid, 0, 0, canvasWidth, canvasHeight);
        ctx.restore();

        // Optimasi penghitungan ukuran teks
        const baseSize = Math.max(20, Math.floor(canvasHeight / 35));
        let fontSize = baseSize;
        if (this.state.settings.textSize === 's') fontSize = baseSize * 0.5;
        if (this.state.settings.textSize === 'm') fontSize = baseSize * 0.8;
        if (this.state.settings.textSize === 'l') fontSize = baseSize * 1.0;
        const margin = Math.floor(fontSize * 1.2);
        const lineHeight = fontSize * 1.3;

        // Set properti rendering sekali saja untuk efisiensi
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        const dateStr = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' });
        // Tampilkan informasi lokasi yang lebih rinci jika tersedia
        // Periksa apakah lokasi valid (bukan default di 0,0 dan merupakan angka)
        let locStr;
        const lat = parseFloat(this.state.location.lat);
        const lng = parseFloat(this.state.location.lng);
        
        if (!isNaN(lat) && !isNaN(lng) && 
            (lat !== 0 || lng !== 0)) {
            // Jika heading tersedia, sertakan dalam informasi
            if (this.state.location.heading !== null && this.state.location.heading !== undefined) {
                const heading = Math.round(this.state.location.heading);
                locStr = `Lat: ${this.state.location.lat}  Long: ${this.state.location.lng}  Acc: ${this.state.location.acc}m  Hdg: ${heading}°`;
            } else {
                locStr = `Lat: ${this.state.location.lat}  Long: ${this.state.location.lng}  Acc: ${this.state.location.acc}m`;
            }
        } else {
            locStr = "Lokasi belum tersedia";
        }
        let lines = [dateStr, locStr];
        if (this.state.settings.projNote) lines.unshift(this.state.settings.projNote);
        if (this.state.settings.projName) lines.unshift(this.state.settings.projName.toUpperCase());
        const textBlockHeight = lines.length * lineHeight;

        // Hitung dimensi logo jika ada
        let logoW = 0, logoH = 0;
        if (this.state.customLogoImg) {
            logoW = canvasWidth * 0.20;
            logoH = logoW / (this.state.customLogoImg.width / this.state.customLogoImg.height);
        }

        // Tentukan posisi berdasarkan pengaturan
        const posCoords = {
            tl: { x: margin, y: margin, align: 'left' },
            tr: { x: canvasWidth - margin, y: margin, align: 'right' },
            bl: { x: margin, y: canvasHeight - margin, align: 'left' },
            br: { x: canvasWidth - margin, y: canvasHeight - margin, align: 'right' }
        };
        let tPos = { ...posCoords[this.state.settings.textPos] };
        let lPos = { ...posCoords[this.state.settings.logoPos] };

        // Atur posisi untuk menghindari tumpang tindih
        if (this.state.settings.textPos === this.state.settings.logoPos && this.state.customLogoImg) {
            const isTop = this.state.settings.textPos.includes('t');
            const gap = fontSize;
            if (isTop) { tPos.y = lPos.y + logoH + gap; }
            else { lPos.y = tPos.y - textBlockHeight - gap - logoH; }
        }

        // Gambar logo jika tersedia
        if (this.state.customLogoImg) {
            let drawX = lPos.x;
            if (this.state.settings.logoPos.includes('r')) drawX -= logoW;
            ctx.drawImage(this.state.customLogoImg, drawX, lPos.y, logoW, logoH);
        }

        // Setelah menggambar logo, lanjutkan dengan teks
        ctx.textAlign = tPos.align;
        const isTop = this.state.settings.textPos.includes('t');
        let cursorY = tPos.y;

        // Optimasi rendering teks
        if (isTop) {
            cursorY += fontSize;
            for (const line of lines) {
                // Set warna dan font hanya saat perlu
                if (line === this.state.settings.projName.toUpperCase()) ctx.fillStyle = '#FBBF24';
                else ctx.fillStyle = '#FFFFFF';

                if (line === this.state.settings.projNote) ctx.font = `${fontSize}px 'Inter', sans-serif`;
                else ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;

                ctx.fillText(line, tPos.x, cursorY);
                cursorY += lineHeight;
            }
        } else {
            // Gunakan reverse loop yang lebih efisien
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                if (line === this.state.settings.projName.toUpperCase()) ctx.fillStyle = '#FBBF24';
                else ctx.fillStyle = '#FFFFFF';

                if (line === this.state.settings.projNote) ctx.font = `${fontSize}px 'Inter', sans-serif`;
                else ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;

                ctx.fillText(line, tPos.x, cursorY);
                cursorY -= lineHeight;
            }
        }

        // Tambahkan QR code jika diaktifkan
        if (this.state.settings.qrCodeEnabled && this.qrCodeGenerator) {
            console.log('Adding QR code to canvas, location:', this.state.location);
            await this.addQRCodeToCanvas(ctx, canvasWidth, canvasHeight);
        }

        // Kita perlu akses ke storage service, jadi kita emit event
        this.eventBus.emit('canvas:captureComplete', cvs.toDataURL('image/jpeg', 0.90));
    }

    /**
     * Menambahkan QR code ke canvas
     */
    async addQRCodeToCanvas(ctx, canvasWidth, canvasHeight) {
        try {
            // Generate URL untuk QR code
            const lat = parseFloat(this.state.location.lat);
            const lng = parseFloat(this.state.location.lng);
            
            if (isNaN(lat) || isNaN(lng)) {
                console.warn('Invalid location coordinates for QR code generation');
                return;
            }
            
            const mapUrl = this.qrCodeGenerator.generateMapUrl(
                lat,
                lng
            );

            // Generate QR code image
            const qrCodeImage = await this.qrCodeGenerator.generateLocationQRCode(this.state.location);

            if (!qrCodeImage) {
                console.warn('Gagal membuat QR code - mungkin location tidak valid');
                return;
            }

            // Load image untuk digambar ke canvas
            const img = new Image();
            img.src = qrCodeImage;

            // Harus menunggu image load sebelum menggambar
            await new Promise((resolve) => {
                img.onload = () => {
                    // Hitung ukuran QR code berdasarkan pengaturan - minimal 120px untuk scanner mobile
                    const baseSize = Math.max(120, Math.floor(canvasHeight / 6)); // Minimal 120px untuk scan yang lebih baik
                    let qrSize = baseSize;

                    if (this.state.settings.qrCodeSize === 's') qrSize = baseSize * 0.8; // Kecil
                    if (this.state.settings.qrCodeSize === 'l') qrSize = baseSize * 1.2; // Besar

                    // Tentukan posisi QR code - gunakan margin kecil untuk membuat lebih ke pojok
                    const margin = Math.floor(qrSize * 0.1); // Margin kecil untuk membuat QR code lebih ke pojok
                    const posCoords = {
                        tl: { x: margin, y: margin },
                        tr: { x: canvasWidth - margin - qrSize, y: margin },
                        bl: { x: margin, y: canvasHeight - margin - qrSize },
                        br: { x: canvasWidth - margin - qrSize, y: canvasHeight - margin - qrSize }
                    };

                    const qrPos = posCoords[this.state.settings.qrCodePos] || posCoords.br;

                    // Tambah background putih untuk kontras yang lebih baik
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Semi-transparan putih
                    ctx.fillRect(qrPos.x - 5, qrPos.y - 5, qrSize + 10, qrSize + 10);

                    // Gambar QR code ke canvas
                    ctx.drawImage(img, qrPos.x, qrPos.y, qrSize, qrSize);

                    // Pastikan tidak bentrok dengan teks/logo
                    this.adjustPositionForConflict(ctx, qrPos, qrSize, canvasWidth, canvasHeight);

                    resolve();
                };

                img.onerror = () => {
                    console.error('Gagal load QR code image');
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error adding QR code to canvas:', error);
        }
    }

    /**
     * Mengatur posisi agar tidak tumpang tindih dengan elemen lain
     */
    adjustPositionForConflict(ctx, qrPos, qrSize, canvasWidth, canvasHeight) {
        // Cek apakah posisi QR sama dengan posisi teks atau logo
        const textPos = this.state.settings.textPos;
        const logoPos = this.state.settings.logoPos;
        const qrPosKey = this.state.settings.qrCodePos;

        // Jika QR posisi sama dengan teks atau logo, geser QR code
        if (qrPosKey === textPos || qrPosKey === logoPos) {
            // Geser ke posisi yang berbeda, misalnya ke kiri atas jika memungkinkan
            const margin = Math.floor(qrSize * 0.1); // Gunakan margin kecil yang konsisten
            if (qrPosKey !== 'tl' && qrPos.x > qrSize + margin && qrPos.y > qrSize + margin) {
                qrPos.x = margin;
                qrPos.y = margin;
            } else if (qrPosKey !== 'tr' && qrPos.x < canvasWidth - qrSize - margin) {
                qrPos.x = canvasWidth - margin - qrSize;
                qrPos.y = margin;
            } else if (qrPosKey !== 'bl') {
                qrPos.x = margin;
                qrPos.y = canvasHeight - margin - qrSize;
            }
            // Gambar ulang QR code di posisi baru
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(qrPos.x - 5, qrPos.y - 5, qrSize + 10, qrSize + 10);
            // Catatan: Gambar ulang QR code di sini tidak efisien, tapi untuk sekarang cukup
        }
    }
}