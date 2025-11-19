/**
 * Drawing Service Module
 * Provides pure functions for drawing elements onto a canvas context.
 * This service is shared between the main thread (CanvasProcessorService) and the canvas worker.
 */

/**
 * Draws the complete watermark block (text, logo, QR code).
 * @param {CanvasRenderingContext2D} ctx - The canvas context to draw on.
 * @param {object} settings - The application settings.
 * @param {object} location - The current location data.
 * @param {object} dimensions - The canvas dimensions { width, height }.
 * @param {Image} [customLogoImg=null] - The custom logo image object.
 * @param {Image} [qrCodeImg=null] - The QR code image object.
 */
export async function drawWatermark(ctx, settings, location, dimensions, customLogoImg = null, qrCodeImg = null) {
    const { width: canvasWidth, height: canvasHeight } = dimensions;

    // --- Text Watermark ---
    const baseSize = Math.max(20, Math.floor(canvasHeight / 35));
    let fontSize = baseSize;
    if (settings.textSize === 's') fontSize = baseSize * 0.5;
    if (settings.textSize === 'm') fontSize = baseSize * 0.8;
    if (settings.textSize === 'l') fontSize = baseSize * 1.0;
    const margin = Math.floor(fontSize * 1.2);
    const lineHeight = fontSize * 1.3;

    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const dateStr = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' });
    let locStr;
    const lat = parseFloat(location.lat);
    const lng = parseFloat(location.lng);

    if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
        let headingInfo = '';
        if (location.heading !== null && location.heading !== undefined) {
            headingInfo = `  Hdg: ${Math.round(location.heading)}°`;
        }
        locStr = `Lat: ${location.lat}  Long: ${location.lng}  Acc: ${location.acc}m${headingInfo}`;
    } else {
        locStr = "Lokasi belum tersedia";
    }

    let lines = [dateStr, locStr];
    if (settings.projNote) lines.unshift(settings.projNote);
    if (settings.projName) lines.unshift(settings.projName.toUpperCase());

    const textBlockHeight = lines.length * lineHeight;

    // --- Logo Drawing ---
    if (settings.logoPos && customLogoImg) {
        await drawLogo(ctx, customLogoImg, settings, dimensions, { textBlockHeight, margin, lineHeight });
    }

    // --- Text Drawing ---
    const textPosCoords = getPosition(margin, canvasWidth, canvasHeight, settings.textPos);
    ctx.textAlign = textPosCoords.align;
    let cursorY = textPosCoords.y;

    if (textPosCoords.isTop) {
        cursorY += fontSize;
        for (const line of lines) {
            ctx.fillStyle = (line === settings.projName.toUpperCase()) ? '#FBBF24' : '#FFFFFF';
            ctx.font = (line === settings.projNote) ? `${fontSize}px 'Inter', sans-serif` : `bold ${fontSize}px 'Inter', sans-serif`;
            ctx.fillText(line, textPosCoords.x, cursorY);
            cursorY += lineHeight;
        }
    } else {
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            ctx.fillStyle = (line === settings.projName.toUpperCase()) ? '#FBBF24' : '#FFFFFF';
            ctx.font = (line === settings.projNote) ? `${fontSize}px 'Inter', sans-serif` : `bold ${fontSize}px 'Inter', sans-serif`;
            ctx.fillText(line, textPosCoords.x, cursorY);
            cursorY -= lineHeight;
        }
    }
    
    // --- QR Code Drawing ---
    if (settings.qrCodeEnabled && qrCodeImg) {
        await drawQRCode(ctx, qrCodeImg, settings, dimensions);
    }
}

/**
 * Calculates the position coordinates for an element.
 * @param {number} margin - The margin around the canvas.
 * @param {number} canvasWidth - The width of the canvas.
 * @param {number} canvasHeight - The height of the canvas.
 * @param {string} position - The position key (e.g., 'tl', 'br').
 * @returns {object} - { x, y, align, isTop }
 */
function getPosition(margin, canvasWidth, canvasHeight, position) {
    const isTop = position.includes('t');
    const isLeft = position.includes('l');
    return {
        x: isLeft ? margin : canvasWidth - margin,
        y: isTop ? margin : canvasHeight - margin,
        align: isLeft ? 'left' : 'right',
        isTop: isTop,
    };
}

/**
 * Draws a logo on the canvas, handling potential position conflicts with text.
 * @param {CanvasRenderingContext2D} ctx - The canvas context.
 * @param {Image} logoImg - The logo image to draw.
 * @param {object} settings - Application settings.
 * @param {object} dimensions - Canvas dimensions.
 * @param {object} textMetrics - Metrics about the text block for conflict avoidance.
 */
export async function drawLogo(ctx, logoImg, settings, dimensions, textMetrics) {
    const { width: canvasWidth, height: canvasHeight } = dimensions;
    const { textBlockHeight, margin, lineHeight } = textMetrics;
    
    let logoW = canvasWidth * 0.20;
    let logoH = logoW / (logoImg.width / logoImg.height);
    
    const logoPosCoords = getPosition(margin, canvasWidth, canvasHeight, settings.logoPos);
    
    // Adjust for right-aligned logos
    let drawX = logoPosCoords.x;
    if (settings.logoPos.includes('r')) {
        drawX -= logoW;
    }

    let drawY = logoPosCoords.y;

    // Conflict resolution with text
    if (settings.logoPos === settings.textPos) {
        const gap = lineHeight;
        if (logoPosCoords.isTop) {
            // If logo and text are on top, text is already pushed down by drawWatermark's logic.
            // This function only needs to draw the logo at the very top.
        } else {
            // If logo and text are at the bottom, push logo above the text.
            drawY = canvasHeight - margin - textBlockHeight - gap - logoH;
        }
    }
    
    ctx.drawImage(logoImg, drawX, drawY, logoW, logoH);
}


/**
 * Draws a QR code on the canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas context.
 * @param {Image} qrCodeImg - The QR code image.
 * @param {object} settings - Application settings.
 * @param {object} dimensions - Canvas dimensions.
 */
export async function drawQRCode(ctx, qrCodeImg, settings, dimensions) {
    const { width: canvasWidth, height: canvasHeight } = dimensions;
    
    const baseSize = Math.max(160, Math.floor(canvasHeight / 6));
    let qrSize = baseSize;
    if (settings.qrCodeSize === 's') qrSize = baseSize * 0.8;
    if (settings.qrCodeSize === 'l') qrSize = baseSize * 1.2;

    const margin = Math.floor(qrSize * 0.1);
    const qrPosCoords = getPosition(margin, canvasWidth, canvasHeight, settings.qrCodePos);

    let drawX = qrPosCoords.x;
    let drawY = qrPosCoords.y;

    if(settings.qrCodePos.includes('r')) drawX -= qrSize;
    if(settings.qrCodePos.includes('b')) drawY -= qrSize;

    // Add white background for better contrast
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(drawX - 5, drawY - 5, qrSize + 10, qrSize + 10);
    
    ctx.drawImage(qrCodeImg, drawX, drawY, qrSize, qrSize);
}
