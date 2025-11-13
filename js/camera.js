/**
 * Camera Service Module
 * Mengelola fungsionalitas kamera
 */

export class CameraService {
    constructor({ state, dom, canvasProcessorService, eventBus, notificationService }) {
        this.state = state;
        this.dom = dom;
        this.canvasProcessorService = canvasProcessorService;
        this.eventBus = eventBus;
        this.notificationService = notificationService;
    }

    async start() {
        if (this.state.stream) this.state.stream.getTracks().forEach(t => t.stop());
        try {
            this.state.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: this.state.facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });

            // Check if video element exists before setting properties
            if (this.dom.video) {
                this.dom.video.srcObject = this.state.stream;
                this.dom.video.style.transform = (this.state.facingMode === 'user') ? 'scaleX(-1)' : 'scaleX(1)';
            }

            setTimeout(async () => {
                this.checkCapabilities();
                // Restore the zoom level after capabilities are checked
                await this.setZoom(this.state.zoomLevel);
            }, 500);
        } catch (err) {
            console.error(err);
            if (this.dom.lblGeo) {
                this.dom.lblGeo.innerHTML = `<i class="ph ph-warning text-red-400" aria-hidden="true"></i> Error: Kamera Ditolak`;
            }
        }
    }

    checkCapabilities() {
        try {
            const caps = this.state.stream.getVideoTracks()[0].getCapabilities();
            this.state.hasFlash = !!caps.torch;
        } catch(e) {
            this.state.hasFlash = false;
        }
        this.state.isFlashOn = false;
        this.updateFlashUI();
    }

    toggleFlash() {
        if (!this.state.hasFlash || !this.state.stream) return;
        this.state.isFlashOn = !this.state.isFlashOn;
        this.state.stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: this.state.isFlashOn }] })
            .catch(e => console.log("Torch fail", e));
        this.updateFlashUI();
    }

    updateFlashUI() {
        if (!this.state.hasFlash || this.state.facingMode === 'user') {
            this.dom.btnFlash.classList.add('hidden');
        } else {
            this.dom.btnFlash.classList.remove('hidden');
            if (this.state.isFlashOn) {
                this.dom.iconFlash.className = "ph ph-lightning text-xl text-yellow-400";
                this.dom.btnFlash.classList.add('bg-yellow-500/20', 'border-yellow-500/50');
                this.dom.btnFlash.setAttribute('aria-label', 'Matikan Lampu Kilat');
            } else {
                this.dom.iconFlash.className = "ph ph-lightning-slash text-xl text-white/70";
                this.dom.btnFlash.classList.remove('bg-yellow-500/20', 'border-yellow-500/50');
                this.dom.btnFlash.setAttribute('aria-label', 'Nyalakan Lampu Kilat');
            }
        }
    }

    switch() {
        if(navigator.vibrate) navigator.vibrate(30);
        this.state.facingMode = (this.state.facingMode === 'environment') ? 'user' : 'environment';
        this.start();
    }

    async setZoom(zoomLevel) {
        if (!this.state.stream) return;

        // Ensure zoom level is at least 1.0
        const validatedZoomLevel = Math.max(1.0, zoomLevel);
        
        const videoTrack = this.state.stream.getVideoTracks()[0];
        if (!videoTrack) return;

        try {
            // Check if zoom is supported by the device
            const capabilities = videoTrack.getCapabilities();
            if (!capabilities.zoom) {
                console.log("Zoom not supported by this device, using fallback");
                // Fallback to CSS transform scale if zoom is not supported
                this.applyZoomFallback(validatedZoomLevel);
                return;
            }

            // Get the maximum zoom level supported by the device
            const maxZoom = capabilities.zoom.max || 10;
            const requestedZoom = Math.min(validatedZoomLevel, maxZoom);

            // Apply the zoom constraint
            await videoTrack.applyConstraints({
                advanced: [{ zoom: requestedZoom }] 
            });

            // Update the state with the actual zoom level
            this.state.zoomLevel = requestedZoom;

            // Emit event to notify zoom change
            this.eventBus.emit('zoom:changed', requestedZoom);

            console.log(`Zoom set to ${requestedZoom}x`);
            return requestedZoom;
        } catch (error) {
            console.error("Error setting zoom:", error);
            // Fallback to CSS transform scale if constraints fail
            this.applyZoomFallback(validatedZoomLevel);
            return this.state.zoomLevel;
        }
    }

    applyZoomFallback(zoomLevel) {
        // Fallback implementation using CSS transform scale
        // This isn't true zoom but provides a similar visual effect
        if (this.dom.video) {
            // Apply zoom level with horizontal flip if needed - combine both transforms in one call
            const flip = (this.state.facingMode === 'user') ? 'scaleX(-1)' : 'scaleX(1)';
            this.dom.video.style.transform = `scale(${zoomLevel}) ${flip}`;
        }
        // Ensure zoom level is at least 1.0
        this.state.zoomLevel = Math.max(1.0, zoomLevel);

        // Emit event to notify zoom change
        this.eventBus.emit('zoom:changed', this.state.zoomLevel);
    }

    async resetZoom() {
        await this.setZoom(1.0);
    }

    async shutter() {
        // Check if GPS location is ready before capturing
        const isLocationReady = this.isLocationReady();
        
        if (!isLocationReady) {
            // Show notification that GPS is not ready
            this.showGPSNotification();
        }
        
        if(navigator.vibrate) navigator.vibrate(50);
        if (this.dom.flashOverlay) {
            this.dom.flashOverlay.classList.add('flash-active');
            setTimeout(() => {
                if (this.dom.flashOverlay) {
                    this.dom.flashOverlay.classList.remove('flash-active');
                }
            }, 150);
        }
        
        // Emit event untuk memberi tahu bahwa lokasi mungkin perlu diperbarui 
        // sebelum pengambilan gambar untuk memastikan akurasi terkini digunakan
        this.eventBus.emit('location:requestRefresh');
        
        await this.canvasProcessorService.capture();
    }

    // Check if GPS location is ready with valid coordinates
    isLocationReady() {
        const lat = parseFloat(this.state.location.lat);
        const lng = parseFloat(this.state.location.lng);
        
        // Location is ready if we have valid coordinates (not NaN and not the default 0,0)
        return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
    }

    // Show notification about GPS status using global notification service
    showGPSNotification() {
        if (this.notificationService) {
            this.notificationService.show('GPS belum siap, foto tidak akan berisi lokasi akurat!', 'warning', 3000);
        } else {
            // Fallback ke event bus jika notification service tidak tersedia
            this.eventBus.emit('notification:show', {
                message: 'GPS belum siap, foto tidak akan berisi lokasi akurat!',
                type: 'warning',
                duration: 3000
            });
        }
    }

    /**
     * Cleanup camera resources
     */
    destroy() {
        if (this.state.stream) {
            this.state.stream.getTracks().forEach(track => track.stop());
            this.state.stream = null;
        }
    }
}