/**
 * Canvas Processor Module
 * Manages image processing using canvas, optimizing for performance by using a Web Worker.
 */
import * as drawing from './drawingService.js';



export class CanvasProcessorService {

    constructor({ state, dom, eventBus, qrCodeGenerator, storageService }) {

        this.state = state;

        this.dom = dom;

        this.eventBus = eventBus;

        this.qrCodeGenerator = qrCodeGenerator;

        this.storageService = storageService;



        const isLowEnd = this.isLowEndDevice();

        this.maxCanvasWidth = isLowEnd ? 1280 : 1920;

        this.maxCanvasHeight = isLowEnd ? 720 : 1080;



        this.captureQueue = [];

        this.isProcessing = false;

    }



    isLowEndDevice() {

        const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;

        const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;

        return lowMemory || lowCores;

    }



    async capture() {

        return new Promise((resolve) => {

            this.captureQueue.push({ resolve });

            if (!this.isProcessing) {

                this.processCaptureQueue();

            }

        });

    }



    async processCaptureQueue() {

        if (this.captureQueue.length === 0) return;

        this.isProcessing = true;

        

        const { resolve } = this.captureQueue.shift();

        

        try {

            const vid = this.dom.video;

            const canvas = this.dom.canvas;



            if (!vid || !canvas || vid.readyState < vid.HAVE_ENOUGH_DATA) {

                throw new Error('Video or canvas not ready.');

            }



            // Calculate optimal dimensions

            let canvasWidth = vid.videoWidth;

            let canvasHeight = vid.videoHeight;

            const ratio = canvasWidth / canvasHeight;

            if (canvasWidth > this.maxCanvasWidth) {

                canvasWidth = this.maxCanvasWidth;

                canvasHeight = canvasWidth / ratio;

            }

            if (canvasHeight > this.maxCanvasHeight) {

                canvasHeight = this.maxCanvasHeight;

                canvasWidth = canvasHeight * ratio;

            }

            

            canvas.width = canvasWidth;

            canvas.height = canvasHeight;

            

            const ctx = canvas.getContext('2d');

            if (!ctx) throw new Error('Could not get canvas context.');



            // Draw video frame to canvas

            ctx.save();

            if (this.state.facingMode === 'user') {

                ctx.translate(canvasWidth, 0);

                ctx.scale(-1, 1);

            }

            ctx.drawImage(vid, 0, 0, canvasWidth, canvasHeight);

            ctx.restore();

            

            // Generate QR code image if needed

            let qrCodeImg = null;

            if (this.state.settings.qrCodeEnabled) {

                const qrCodeDataUrl = await this.qrCodeGenerator.generateLocationQRCode(this.state.location);

                if (qrCodeDataUrl) {

                    qrCodeImg = await this.loadImage(qrCodeDataUrl);

                }

            }



            // Draw all watermarks

            await drawing.drawWatermark(

                ctx,

                this.state.settings,

                this.state.location,

                { width: canvasWidth, height: canvasHeight },

                this.state.customLogoImg,

                qrCodeImg

            );

            

            // Get final image and save it

            const finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);

            await this.storageService.savePhoto(finalDataUrl);

            

            // Emit completion event

            this.eventBus.emit('canvas:captureComplete', finalDataUrl);



        } catch (error) {

            console.error('Error during capture process:', error);

        } finally {

            this.isProcessing = false;

            if (this.captureQueue.length > 0) {

                this.processCaptureQueue();

            }

            resolve();

        }

    }

    

    async loadImage(src) {

        return new Promise((resolve, reject) => {

            const img = new Image();

            img.onload = () => resolve(img);

            img.onerror = reject;

            img.src = src;

        });

    }

}