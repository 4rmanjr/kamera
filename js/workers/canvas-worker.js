// Canvas processing worker with OffscreenCanvas support
self.onmessage = function(e) {
    const { operation, data, transferables } = e.data;

    switch(operation) {
        case 'processImage':
            processImageOperations(data, transferables);
            break;
        case 'qrCodeReady':
            handleQRCodeReady(data);
            break;
        case 'drawLogo':
            handleDrawLogo(data);
            break;
        default:
            console.warn('Unknown operation:', operation);
    }
};

function processImageOperations(data, transferables) {
    try {
        // Gunakan OffscreenCanvas jika tersedia
        if ('OffscreenCanvas' in self) {
            const canvas = new OffscreenCanvas(data.width, data.height);
            const ctx = canvas.getContext('2d');

            // Gambar video frame ke canvas
            if (data.videoFrame) {
                // Untuk video frame, kita kirim kembali ke main thread sebagai fallback
                // karena kita tidak bisa mengakses video track di web worker
                self.postMessage({
                    operation: 'fallbackToMainThread',
                    data: data
                });
                return;
            } else {
                // Jika tidak ada video frame, gambar dari data gambar
                // atau buat canvas kosong
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, data.width, data.height);
            }

            // Tambahkan watermark teks
            if (data.settings) {
                addTextWatermark(ctx, data.location, data.settings, data.width, data.height);
            }

            // Tambahkan logo jika ada - ditangani terpisah
            // Tambahkan QR code jika diaktifkan
            if (data.settings && data.settings.qrCodeEnabled) {
                // Karena generate QR code tidak bisa dilakukan di worker,
                // kita kembalikan permintaan ke main thread
                self.postMessage({
                    operation: 'requestQRCode',
                    location: data.location,
                    settings: data.settings,
                    dimensions: { width: data.width, height: data.height }
                });

                return;
            }

            // Transfer hasil ke main thread
            const bitmap = canvas.transferToImageBitmap();
            self.postMessage({
                operation: 'resultBitmap',
                bitmap: bitmap
            }, [bitmap]);
        } else {
            // Fallback: kembalikan data ke main thread untuk pemrosesan
            self.postMessage({
                operation: 'fallbackToMainThread',
                data: data
            });
        }
    } catch (error) {
        console.error('Error in processImageOperations:', error);
        self.postMessage({
            operation: 'error',
            error: error.message
        });
    }
}

function handleQRCodeReady(data) {
    // Saat QR code siap dari main thread, kita bisa menggabungkannya
    // dengan canvas yang sedang diproses, tetapi untuk sekarang
    // kita kembalikan ke main thread
    self.postMessage({
        operation: 'qrCodeReadyHandled',
        qrCodeImage: data.qrCodeImage,
        settings: data.settings,
        dimensions: data.dimensions
    });
}

function handleDrawLogo(data) {
    // Saat logo diterima dari main thread
    self.postMessage({
        operation: 'logoReady',
        logo: data.logo,
        settings: data.settings,
        dimensions: data.dimensions
    });
}

function addTextWatermark(ctx, location, settings, canvasWidth, canvasHeight) {
    // Optimasi penghitungan ukuran teks
    const baseSize = Math.max(20, Math.floor(canvasHeight / 35));
    let fontSize = baseSize;
    if (settings.textSize === 's') fontSize = baseSize * 0.5;
    if (settings.textSize === 'm') fontSize = baseSize * 0.8;
    if (settings.textSize === 'l') fontSize = baseSize * 1.0;
    const margin = Math.floor(fontSize * 1.2);
    const lineHeight = fontSize * 1.3;

    // Set properti rendering sekali saja untuk efisiensi
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const dateStr = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' });
    // Tampilkan informasi lokasi yang lebih rinci jika tersedia
    let locStr;
    if (location && location.lat && location.lng) {
        if (location.heading !== null && location.heading !== undefined) {
            const heading = Math.round(location.heading);
            locStr = `Lat: ${location.lat}  Long: ${location.lng}  Acc: ${location.acc}m  Hdg: ${heading}°`;
        } else {
            locStr = `Lat: ${location.lat}  Long: ${location.lng}  Acc: ${location.acc}m`;
        }
    } else {
        locStr = "Lokasi belum tersedia";
    }
    let lines = [dateStr, locStr];
    if (settings.projNote) lines.unshift(settings.projNote);
    if (settings.projName) lines.unshift(settings.projName.toUpperCase());
    const textBlockHeight = lines.length * lineHeight;

    // Tentukan posisi berdasarkan pengaturan
    const posCoords = {
        tl: { x: margin, y: margin, align: 'left' },
        tr: { x: canvasWidth - margin, y: margin, align: 'right' },
        bl: { x: margin, y: canvasHeight - margin, align: 'left' },
        br: { x: canvasWidth - margin, y: canvasHeight - margin, align: 'right' }
    };
    const tPos = { ...posCoords[settings.textPos] };

    // Setelah menggambar logo, lanjutkan dengan teks
    ctx.textAlign = tPos.align;
    const isTop = settings.textPos.includes('t');
    let cursorY = tPos.y;

    // Optimasi rendering teks
    if (isTop) {
        cursorY += fontSize;
        for (const line of lines) {
            // Set warna dan font hanya saat perlu
            if (line === settings.projName.toUpperCase()) ctx.fillStyle = '#FBBF24';
            else ctx.fillStyle = '#FFFFFF';

            if (line === settings.projNote) ctx.font = `${fontSize}px 'Inter', sans-serif`;
            else ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;

            ctx.fillText(line, tPos.x, cursorY);
            cursorY += lineHeight;
        }
    } else {
        // Gunakan reverse loop yang lebih efisien
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (line === settings.projName.toUpperCase()) ctx.fillStyle = '#FBBF24';
            else ctx.fillStyle = '#FFFFFF';

            if (line === settings.projNote) ctx.font = `${fontSize}px 'Inter', sans-serif`;
            else ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;

            ctx.fillText(line, tPos.x, cursorY);
            cursorY -= lineHeight;
        }
    }
}