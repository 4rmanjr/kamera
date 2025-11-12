/**
 * Camera Service Module
 * Mengelola fungsionalitas kamera
 */

export class CameraService {
    constructor({ state, dom, canvasProcessorService, eventBus }) {
        this.state = state;
        this.dom = dom;
        this.canvasProcessorService = canvasProcessorService;
        this.eventBus = eventBus;
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
            this.dom.video.srcObject = this.state.stream;
            this.dom.video.style.transform = (this.state.facingMode === 'user') ? 'scaleX(-1)' : 'scaleX(1)';
            setTimeout(() => this.checkCapabilities(), 500);
        } catch (err) {
            console.error(err);
            this.dom.lblGeo.innerHTML = `<i class="ph ph-warning text-red-400" aria-hidden="true"></i> Error: Kamera Ditolak`;
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

    async shutter() {
        if(navigator.vibrate) navigator.vibrate(50);
        this.dom.flashOverlay.classList.add('flash-active');
        setTimeout(() => this.dom.flashOverlay.classList.remove('flash-active'), 150);
        await this.canvasProcessorService.capture();
    }
}