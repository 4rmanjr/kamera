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

        // Inisialisasi Web Worker untuk operasi berat
        this.worker = null;
        this.initWorker();

        // Queue untuk menangani multiple capture request
        this.captureQueue = [];
        this.isProcessing = false;
    }

    initWorker() {
        try {
            // Membuat Web Worker dari file eksternal untuk pemrosesan canvas
            this.worker = new Worker('js/workers/canvas-worker.js');

            // Handle messages dari worker
            this.worker.onmessage = (e) => {
                const { operation, bitmap, data, location, settings, dimensions, logo, qrCodeImage } = e.data;

                switch(operation) {
                    case 'resultBitmap':
                        // Resolve promise yang menunggu hasil dari worker
                        if (this.pendingWorkerRequests.length > 0) {
                            const resolve = this.pendingWorkerRequests.shift();
                            resolve({ bitmap });
                        }
                        break;

                    case 'requestQRCode':
                        // Worker meminta QR code dari main thread
                        this.generateQRCodeForWorker(location, settings, dimensions);
                        break;

                    case 'requestLogo':
                        // Worker meminta logo dari main thread
                        this.addLogoForWorker(logo, settings, dimensions);
                        break;

                    case 'qrCodeReadyHandled':
                        // Worker sudah menerima QR code, sekarang kita tambahkan ke canvas
                        this.handleQRCodeFromWorker(qrCodeImage, settings, dimensions);
                        break;

                    case 'logoReady':
                        // Worker sudah menerima logo
                        this.handleLogoFromWorker(logo, settings, dimensions);
                        break;

                    case 'fallbackToMainThread':
                        // Worker meminta fallback ke main thread
                        if (this.pendingWorkerRequests.length > 0) {
                            const resolve = this.pendingWorkerRequests.shift();
                            resolve({ useFallback: true });
                        }
                        break;

                    case 'error':
                        console.error('Worker error:', data.error);
                        if (this.pendingWorkerRequests.length > 0) {
                            const resolve = this.pendingWorkerRequests.shift();
                            resolve({ error: data.error });
                        }
                        break;
                }
            };

            // Handle any worker errors
            this.worker.onerror = (error) => {
                console.error('Worker initialization or runtime error:', error);
                // If worker fails completely, we should ensure fallback capture always works
                // In this case, we don't need to do anything special since we already
                // have fallback code, but log the error for debugging
            };
        } catch (error) {
            console.error('Failed to initialize Web Worker:', error);
            // If Web Worker initialization fails completely, set worker to null
            // This will cause the code to use the fallback method directly
            this.worker = null;
        }

        // Array untuk menyimpan promise yang menunggu hasil dari worker
        this.pendingWorkerRequests = [];
    }

    /**
     * Mengirim data ke worker dan menunggu hasilnya
     */
    sendToWorker(message) {
        return new Promise((resolve) => {
            this.pendingWorkerRequests.push(resolve);
            this.worker.postMessage(message);
        });
    }

    /**
     * Fallback ke pemrosesan di main thread jika worker tidak mendukung OffscreenCanvas
     */
    async fallbackCapture(canvas, vid, canvasWidth, canvasHeight) {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Unable to get canvas context for capture');
            return;
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

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

        // Emit hasil dasar ke UI - beri feedback segera ke pengguna
        // Kompresi lebih cepat untuk kecepatan respons
        const basicDataUrl = canvas.toDataURL('image/jpeg', 0.70);
        this.eventBus.emit('canvas:basicReady', basicDataUrl);

        // Tambahkan QR code secara lazy jika diaktifkan
        if (this.state.settings.qrCodeEnabled && this.qrCodeGenerator) {
            setTimeout(async () => {
                try {
                    console.log('Adding QR code to canvas (fallback lazy), location:', this.state.location);
                    const ctx = canvas.getContext('2d');
                    await this.addQRCodeToCanvas(ctx, canvasWidth, canvasHeight);

                    // Simpan hasil akhir dengan kualitas penuh setelah QR code selesai
                    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    this.eventBus.emit('canvas:captureComplete', finalDataUrl);
                } catch (error) {
                    console.error('Error adding QR code, sending basic image instead:', error);
                    // Jika error saat menambahkan QR code, kirim data basic saja
                    this.eventBus.emit('canvas:captureComplete', basicDataUrl);
                }
            }, 0);
        } else {
            // Jika tidak ada QR code, kirim hasil akhir sekarang
            this.eventBus.emit('canvas:captureComplete', basicDataUrl);
        }
    }

    /**
     * Generate QR code untuk worker dan kirimkan kembali
     */
    async generateQRCodeForWorker(location, settings, dimensions) {
        if (!this.qrCodeGenerator) return;

        const qrCodeImage = await this.qrCodeGenerator.generateLocationQRCode(location);
        if (!qrCodeImage) return;

        // Kirim QR code kembali ke worker
        this.worker.postMessage({
            operation: 'qrCodeReady',
            qrCodeImage,
            settings,
            dimensions
        });
    }

    /**
     * Tambahkan logo untuk worker
     */
    addLogoForWorker(logo, settings, dimensions) {
        // Kirim instruksi ke worker untuk menggambar logo
        this.worker.postMessage({
            operation: 'drawLogo',
            logo,
            settings,
            dimensions
        });
    }

    /**
     * Handle QR code yang dikirim dari worker
     */
    async handleQRCodeFromWorker(qrCodeImage, settings, dimensions) {
        // Karena kita tidak bisa menggambar langsung dari worker ke canvas,
        // kita simpan informasi ini dan gambarkan saat kita menerima hasil akhir
        this.pendingQRCode = { qrCodeImage, settings, dimensions };
    }

    /**
     * Handle logo yang dikirim dari worker
     */
    handleLogoFromWorker(logo, settings, dimensions) {
        // Simpan informasi logo untuk digambar nanti
        this.pendingLogo = { logo, settings, dimensions };
    }

    /**
     * Gambarkan logo yang tertunda ke canvas
     */
    async drawPendingLogo(ctx, pendingLogo, canvasWidth, canvasHeight) {
        if (!pendingLogo || !pendingLogo.logo) return;

        // Implementasi penggambaran logo ke canvas
        const { logo, settings, dimensions } = pendingLogo;
        const { width, height } = dimensions;

        // Hitung dimensi logo
        let logoW = width * 0.20;
        let logoH = logoW / (logo.width / logo.height);

        // Tentukan posisi berdasarkan pengaturan
        const margin = 20; // Sesuaikan dengan margin teks
        const posCoords = {
            tl: { x: margin, y: margin },
            tr: { x: width - margin - logoW, y: margin },
            bl: { x: margin, y: height - margin - logoH },
            br: { x: width - margin - logoW, y: height - margin - logoH }
        };

        const lPos = { ...posCoords[settings.logoPos] };

        // Buat dan gambar logo
        const img = new Image();
        img.src = logo.url;

        await new Promise((resolve) => {
            img.onload = () => {
                ctx.drawImage(img, lPos.x, lPos.y, logoW, logoH);
                resolve();
            };
            img.onerror = () => resolve(); // Lanjutkan meskipun error
        });
    }

    /**
     * Gambarkan QR code yang tertunda ke canvas
     */
    async drawPendingQRCode(ctx, pendingQRCode, canvasWidth, canvasHeight) {
        if (!pendingQRCode || !pendingQRCode.qrCodeImage) return;

        // Ambil informasi dari pending QR code
        const { qrCodeImage, settings, dimensions } = pendingQRCode;
        const { width, height } = dimensions;

        // Load gambar QR code ke canvas
        const img = new Image();
        img.src = qrCodeImage;

        await new Promise((resolve) => {
            img.onload = () => {
                // Hitung ukuran QR code berdasarkan pengaturan
                const baseSize = Math.max(120, Math.floor(height / 6)); // Minimal 120px untuk scan yang lebih baik
                let qrSize = baseSize;

                if (settings.qrCodeSize === 's') qrSize = baseSize * 0.8; // Kecil
                if (settings.qrCodeSize === 'l') qrSize = baseSize * 1.2; // Besar

                // Tentukan posisi QR code
                const margin = Math.floor(qrSize * 0.1);
                const posCoords = {
                    tl: { x: margin, y: margin },
                    tr: { x: width - margin - qrSize, y: margin },
                    bl: { x: margin, y: height - margin - qrSize },
                    br: { x: width - margin - qrSize, y: height - margin - qrSize }
                };

                const qrPos = posCoords[settings.qrCodePos] || posCoords.br;

                // Tambah background putih untuk kontras yang lebih baik
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(qrPos.x - 5, qrPos.y - 5, qrSize + 10, qrSize + 10);

                // Gambar QR code ke canvas
                ctx.drawImage(img, qrPos.x, qrPos.y, qrSize, qrSize);

                // Pastikan tidak bentrok dengan teks/logo
                this.adjustPositionForConflict(ctx, qrPos, qrSize, width, height);

                resolve();
            };
            img.onerror = () => resolve(); // Lanjutkan meskipun error
        });
    }

    /**
     * Proses QR code secara lazy (async)
     */
    async processQRCodeLazy(ctx, canvasWidth, canvasHeight, basicDataUrl) {
        setTimeout(async () => {
            if (this.state.settings.qrCodeEnabled && this.qrCodeGenerator) {
                try {
                    console.log('Adding QR code to canvas (lazy), location:', this.state.location);
                    await this.addQRCodeToCanvas(ctx, canvasWidth, canvasHeight);

                    // Simpan hasil akhir dengan kualitas penuh setelah QR code selesai
                    const finalDataUrl = ctx.canvas.toDataURL('image/jpeg', 0.85);
                    this.eventBus.emit('canvas:captureComplete', finalDataUrl);
                } catch (error) {
                    console.error('Error in processQRCodeLazy:', error);
                    // Jika error saat menambahkan QR code, kirim data basic saja
                    // agar foto minimal bisa disimpan tanpa QR code
                    if (basicDataUrl) {
                        this.eventBus.emit('canvas:captureComplete', basicDataUrl);
                    } else {
                        // Jika tidak ada basicDataUrl sebagai fallback, gunakan versi yang diambil dari canvas langsung
                        const fallbackDataUrl = ctx.canvas.toDataURL('image/jpeg', 0.70);
                        this.eventBus.emit('canvas:captureComplete', fallbackDataUrl);
                    }
                }
            }
        }, 0);
    }

    async capture() {
        // Tambahkan permintaan capture ke queue
        return new Promise((resolve, reject) => {
            this.captureQueue.push({ resolve, reject });

            // Proses queue jika belum sedang diproses
            if (!this.isProcessing) {
                this.processCaptureQueue();
            }
        });
    }

    async processCaptureQueue() {
        if (this.captureQueue.length === 0 || this.isProcessing) {
            return;
        }

        // Tandai bahwa sedang diproses
        this.isProcessing = true;

        // Ambil permintaan pertama dari queue
        const { resolve, reject } = this.captureQueue.shift();

        // Gunakan strategi chunked processing untuk menghindari blocking
        setTimeout(async () => {
            try {
                const vid = this.dom.video;
                const canvas = this.dom.canvas;

                // Check if required DOM elements exist
                if (!vid || !canvas) {
                    console.error('Video or canvas element not found for capture');
                    resolve();
                    this.isProcessing = false;
                    this.processCaptureQueue(); // Proses item berikutnya dalam queue
                    return;
                }

                // Check if video is ready before attempting to capture
                if (vid.readyState < vid.HAVE_ENOUGH_DATA) {
                    console.error('Video not ready for capture, readyState:', vid.readyState);
                    // Try to wait briefly for video to be ready
                    await new Promise((resolve) => {
                        const checkReady = () => {
                            if (vid.readyState >= vid.HAVE_ENOUGH_DATA) {
                                resolve();
                            } else {
                                setTimeout(checkReady, 50);
                            }
                        };
                        checkReady();
                    });

                    // Double check after waiting
                    if (vid.readyState < vid.HAVE_ENOUGH_DATA) {
                        console.error('Video still not ready after waiting, cannot capture');
                        this.eventBus.emit('canvas:captureComplete', canvas.toDataURL('image/jpeg', 0.70));
                        resolve();
                        this.isProcessing = false;
                        this.processCaptureQueue();
                        return;
                    }
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

                // Kirim permintaan pemrosesan ke Web Worker
                if (this.worker) {
                    // For Web Workers, we can't directly access video frame from the main thread
                    // So instead, we'll use the fallback method which runs in the main thread
                    // This is because Web APIs like video capture don't work in worker context
                    // Or implement a more appropriate approach for worker processing
                    const processData = {
                        width: canvasWidth,
                        height: canvasHeight,
                        // Indicate that this is video frame processing so worker knows to fall back
                        videoFrame: true,
                        location: this.state.location,
                        settings: this.state.settings,
                        customLogo: this.state.customLogoImg ? {
                            url: this.state.customLogoImg.src,
                            width: this.state.customLogoImg.width,
                            height: this.state.customLogoImg.height
                        } : null
                    };

                    // Tunggu hasil dari worker
                    const result = await this.sendToWorker({
                        operation: 'processImage',
                        data: processData
                    });

                    if (result && result.bitmap) {
                        // Jika OffscreenCanvas didukung, hasilnya adalah ImageBitmap
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            canvas.width = canvasWidth;
                            canvas.height = canvasHeight;
                            ctx.drawImage(result.bitmap, 0, 0);

                            // Tambahkan logo yang tertunda jika ada
                            if (this.pendingLogo) {
                                await this.drawPendingLogo(ctx, this.pendingLogo, canvasWidth, canvasHeight);
                                this.pendingLogo = null; // Reset
                            }

                            // Emit hasil dasar ke UI - beri feedback segera ke pengguna
                            // Kompresi lebih cepat untuk kecepatan respons
                            const basicDataUrl = canvas.toDataURL('image/jpeg', 0.70);
                            this.eventBus.emit('canvas:basicReady', basicDataUrl);

                            // Tambahkan QR code yang tertunda jika ada, atau proses secara lazy
                            if (this.pendingQRCode) {
                                try {
                                    await this.drawPendingQRCode(ctx, this.pendingQRCode, canvasWidth, canvasHeight);
                                    this.pendingQRCode = null; // Reset

                                    // Simpan hasil akhir setelah QR code selesai
                                    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                    this.eventBus.emit('canvas:captureComplete', finalDataUrl);
                                } catch (error) {
                                    console.error('Error drawing pending QR code, sending basic image:', error);
                                    // Jika error saat menambahkan QR code, kirim data basic saja
                                    const basicDataUrl = canvas.toDataURL('image/jpeg', 0.70);
                                    this.eventBus.emit('canvas:captureComplete', basicDataUrl);
                                }
                            } else if (this.state.settings.qrCodeEnabled && this.qrCodeGenerator) {
                                // Proses QR code secara lazy
                                const basicDataUrlForLazy = canvas.toDataURL('image/jpeg', 0.70);
                                this.processQRCodeLazy(ctx, canvasWidth, canvasHeight, basicDataUrlForLazy);
                            } else {
                                // Jika tidak ada QR code, kirim hasil akhir sekarang
                                const finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                this.eventBus.emit('canvas:captureComplete', finalDataUrl);
                            }
                        }
                    } else if (result && result.useFallback) {
                        // Jika worker tidak mendukung OffscreenCanvas, gunakan fallback
                        await this.fallbackCapture(canvas, vid, canvasWidth, canvasHeight);
                    }
                } else {
                    // Jika worker tidak tersedia, gunakan fallback
                    await this.fallbackCapture(canvas, vid, canvasWidth, canvasHeight);
                }

                // Resolve the promise
                resolve();

                // Tandai bahwa sudah selesai diproses dan proses item berikutnya
                this.isProcessing = false;
                this.processCaptureQueue(); // Proses item berikutnya dalam queue
            } catch (error) {
                console.error('Error in capture:', error);
                reject(error);

                // Tandai bahwa sudah selesai diproses dan proses item berikutnya
                this.isProcessing = false;
                this.processCaptureQueue(); // Proses item berikutnya dalam queue
            }
        }, 0); // Defer execution using setTimeout
    }

    /**
     * Menambahkan QR code ke canvas (async non-blocking)
     */
    async addQRCodeToCanvas(ctx, canvasWidth, canvasHeight) {
        return new Promise((resolve) => {
            // Tampilkan indikator proses QR code
            this.showQRGeneratingIndicator();

            // Gunakan setTimeout untuk mencegah blocking di main thread
            setTimeout(async () => {
                try {
                    // Generate URL untuk QR code
                    const lat = parseFloat(this.state.location.lat);
                    const lng = parseFloat(this.state.location.lng);

                    if (isNaN(lat) || isNaN(lng)) {
                        console.warn('Invalid location coordinates for QR code generation');
                        this.hideQRGeneratingIndicator();
                        resolve();
                        return;
                    }

                    // Generate QR code image secara async
                    const qrCodeImage = await this.qrCodeGenerator.generateLocationQRCode(this.state.location);

                    if (!qrCodeImage) {
                        console.warn('Gagal membuat QR code - mungkin location tidak valid');
                        this.hideQRGeneratingIndicator();
                        resolve();
                        return;
                    }

                    // Load image untuk digambar ke canvas
                    const img = new Image();
                    img.src = qrCodeImage;

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

                        this.hideQRGeneratingIndicator();
                        resolve();
                    };

                    img.onerror = () => {
                        console.error('Gagal load QR code image');
                        this.hideQRGeneratingIndicator();
                        resolve();
                    };
                } catch (error) {
                    console.error('Error adding QR code to canvas:', error);
                    this.hideQRGeneratingIndicator();
                    resolve();
                }
            }, 0); // Defer execution using setTimeout
        });
    }

    /**
     * Menampilkan indikator saat QR code sedang diproses
     */
    showQRGeneratingIndicator() {
        if (this.dom.lblGeo) {
            const originalHTML = this.dom.lblGeo.innerHTML;
            this.dom.lblGeo.innerHTML = `<i class="ph ph-spinner animate-spin mr-1 text-blue-400" aria-hidden="true"></i> Menyisipkan QR...`;

            // Simpan state asli untuk dikembalikan nanti
            this.originalGeoHTML = originalHTML;
        }
    }

    /**
     * Menyembunyikan indikator proses QR code
     */
    hideQRGeneratingIndicator() {
        if (this.dom.lblGeo && this.originalGeoHTML) {
            this.dom.lblGeo.innerHTML = this.originalGeoHTML;
            this.originalGeoHTML = null;
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

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}