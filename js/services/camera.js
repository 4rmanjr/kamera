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
            
            // Show camera status when camera starts successfully
            if (this.dom.lblCameraStatus) {
                this.dom.lblCameraStatus.innerHTML = `<i class="ph ph-camera text-blue-400 mr-1" aria-hidden="true"></i> Menyiapkan Kamera...`;
                this.dom.lblCameraStatus.classList.remove('hidden');

                // Hide the status after 3 seconds
                setTimeout(() => {
                    if (this.dom.lblCameraStatus) {
                        this.dom.lblCameraStatus.classList.add('hidden');
                    }
                }, 3000);
            }
        } catch (err) {
            console.error('Camera error:', err);
            
            // Provide more specific error messages based on error type
            let errorMessage = "Error: Kamera Ditolak";
            if (err.name === 'NotAllowedError') {
                errorMessage = "Izin kamera ditolak";
            } else if (err.name === 'NotFoundError') {
                errorMessage = "Kamera tidak ditemukan";
            } else if (err.name === 'NotReadableError') {
                errorMessage = "Kamera sedang digunakan oleh aplikasi lain";
            } else if (err.name === 'OverconstrainedError') {
                errorMessage = "Kamera tidak mendukung konfigurasi yang diminta";
            } else if (err.name === 'SecurityError' || err.name === 'TypeError') {
                errorMessage = "Tidak dapat mengakses kamera";
            }
            
            if (this.dom.lblCameraStatus) {
                this.dom.lblCameraStatus.innerHTML = `<i class="ph ph-warning text-red-400 mr-1" aria-hidden="true"></i> ${errorMessage}`;
                this.dom.lblCameraStatus.classList.remove('hidden');

                // Hide the error status after 5 seconds
                setTimeout(() => {
                    if (this.dom.lblCameraStatus) {
                        this.dom.lblCameraStatus.classList.add('hidden');
                    }
                }, 5000);
            }
            
            // If notification service is available, show notification
            if (this.notificationService) {
                this.notificationService.show(errorMessage, 'error', 3000);
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
        let isLocationReady = this.isLocationReady();

        // Jika lokasi belum siap, tunggu sejenak untuk mendapatkan lokasi
        if (!isLocationReady) {
            // Tunggu hingga lokasi siap sebelum mengambil foto (maksimal 3 detik)
            isLocationReady = await this.waitForLocationReady(50, 3000); // Akurasi <= 50 meter dalam 3 detik

            // Jika setelah ditunggu tetap tidak siap, beri tahu pengguna
            if (!isLocationReady) {
                this.showGPSNotification();
            }
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

    /**
     * Tunggu hingga lokasi siap sebelum mengambil foto
     * @param {number} minAccuracy - Akurasi minimum yang diinginkan (meter)
     * @param {number} timeout - Waktu maksimum untuk menunggu (milidetik)
     * @returns {Promise<boolean>} True jika lokasi siap sebelum timeout
     */
    async waitForLocationReady(minAccuracy = 100, timeout = 3000) {
        const startTime = Date.now();
        let locationReady = this.isLocationReady();

        // Cek apakah akurasi sudah memenuhi syarat minimum
        const hasGoodAccuracy = () => {
            const acc = parseFloat(this.state.location.acc);
            return !isNaN(acc) && acc > 0 && acc <= minAccuracy;
        };

        while ((!locationReady || !hasGoodAccuracy()) && (Date.now() - startTime) < timeout) {
            // Tunggu sebentar sebelum cek ulang
            await new Promise(resolve => setTimeout(resolve, 250));
            locationReady = this.isLocationReady();
        }

        return locationReady && hasGoodAccuracy();
    }

    // Check if GPS location is ready with valid coordinates
    isLocationReady() {
        const lat = parseFloat(this.state.location.lat);
        const lng = parseFloat(this.state.location.lng);
        const acc = parseFloat(this.state.location.acc);

        // Location is ready if we have valid coordinates that are not 0,0 and have reasonable accuracy
        return !isNaN(lat) && !isNaN(lng) && !isNaN(acc) &&
               (Math.abs(lat) > 0.00001 || Math.abs(lng) > 0.00001) &&
               acc > 0 && acc <= 1000;
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
     * Pause camera (stop the stream but keep settings)
     */
    pause() {
        if (this.state.stream) {
            this.state.stream.getTracks().forEach(track => track.stop());
            this.state.stream = null;
        }
    }

    /**
     * Check if camera service is active
     */
    isActive() {
        return !!(this.state.stream && this.state.stream.active);
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