/**
 * UI Controller Module
 * Mengelola event listeners dan fungsionalitas UI
 */

export class UIController {
    constructor({ state, dom, storageService, galleryController, previewController, cameraService, locationService, utils, eventBus }) {
        this.state = state;
        this.dom = dom;
        this.storageService = storageService;
        this.galleryController = galleryController;
        this.previewController = previewController;
        this.cameraService = cameraService;
        this.locationService = locationService;
        this.utils = utils;
        this.eventBus = eventBus;
        
        // Subscribe ke event canvas capture
        this.eventBus.subscribe('canvas:captureComplete', (dataUrl) => {
            this.storageService.savePhoto(dataUrl, () => {
                if (!this.dom.modals.gallery.classList.contains('hidden')) {
                    this.galleryController.load();
                }
            });
        });
        
        // Subscribe ke event gallery load requested
        this.eventBus.subscribe('gallery:loadRequested', (callback) => {
            this.storageService.getAll(callback);
        });
    }

    initListeners() {
        this.dom.btnShutter.onclick = () => this.cameraService.shutter();
        this.dom.btnSwitch.onclick = () => this.cameraService.switch();
        this.dom.btnFlash.onclick = () => this.cameraService.toggleFlash();
        this.dom.btnGallery.onclick = () => this.galleryController.open();
        this.dom.btnSettings.onclick = () => this.dom.modals.settings.classList.remove('hidden');
        document.getElementById('btn-close-settings').onclick = () => this.dom.modals.settings.classList.add('hidden');
        document.getElementById('btn-close-gallery').onclick = () => this.galleryController.close();
        document.getElementById('btn-delete-all').onclick = () => this.confirm("Hapus SEMUA foto?", () => {
            this.storageService.clearAll(() => this.galleryController.load());
        });
        document.getElementById('btn-close-preview').onclick = () => this.previewController.close();
        document.getElementById('btn-download').onclick = () => this.previewController.download();
        document.getElementById('btn-delete-one').onclick = () => this.confirm("Hapus foto ini?", () => {
            this.storageService.delete(this.state.currentPhotoId, () => {
                this.previewController.close();
                this.galleryController.load();
                this.storageService.loadLastThumb();
            });
        });
        document.getElementById('btn-confirm-no').onclick = () => this.dom.modals.confirm.classList.add('hidden');
        document.getElementById('btn-confirm-yes').onclick = () => { 
            if(this.state.confirmCallback) this.state.confirmCallback(); 
            this.dom.modals.confirm.classList.add('hidden'); 
        };
        this.dom.inpProject.oninput = (e) => {
            this.utils.updateSetting(this.state.settings, 'projName', e.target.value);
        };
        this.dom.inpNote.oninput = (e) => {
            this.utils.updateSetting(this.state.settings, 'projNote', e.target.value);
        };
        this.dom.inpLogo.onchange = (e) => {
            if (e.target.files[0]) {
                const r = new FileReader();
                r.onload = (ev) => { 
                    localStorage.setItem('gc_logoImg', ev.target.result); 
                    this.loadLogo(ev.target.result); 
                };
                r.readAsDataURL(e.target.files[0]);
            }
        };
        document.getElementById('btn-clear-logo').onclick = () => this.confirm("Hapus logo?", () => { 
            localStorage.removeItem('gc_logoImg'); 
            this.loadLogo(null); 
            this.dom.inpLogo.value = ''; 
        });
        document.querySelectorAll('.btn-size').forEach(btn => btn.onclick = () => { 
            this.utils.updateSetting(this.state.settings, 'textSize', btn.dataset.size); 
            this.updateSettingsUI(); 
        });
        document.querySelectorAll('.btn-pos').forEach(btn => btn.onclick = () => { 
            if (btn.dataset.type === 'text') {
                this.utils.updateSetting(this.state.settings, 'textPos', btn.dataset.pos);
            } else if (btn.dataset.type === 'logo') {
                this.utils.updateSetting(this.state.settings, 'logoPos', btn.dataset.pos);
            } else if (btn.dataset.type === 'qr') {
                this.utils.updateSetting(this.state.settings, 'qrCodePos', btn.dataset.pos);
            }
            this.updateSettingsUI(); 
        });
        
        // Event listener untuk toggle QR code
        const qrToggle = document.getElementById('toggle-qr-code');
        if (qrToggle) {
            qrToggle.onchange = (e) => {
                this.utils.updateSetting(this.state.settings, 'qrCodeEnabled', e.target.checked);
            };
        }
    }

    confirm(msg, cb) {
        document.getElementById('lbl-confirm-msg').innerText = msg;
        this.state.confirmCallback = cb;
        this.dom.modals.confirm.classList.remove('hidden');
    }

    loadLogo(src) {
        if (!src) {
            this.state.customLogoImg = null;
            this.dom.previewLogo.classList.add('hidden');
            this.dom.txtNoLogo.classList.remove('hidden');
        } else {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                this.state.customLogoImg = img;
                this.dom.previewLogo.src = src;
                this.dom.previewLogo.classList.remove('hidden');
                this.dom.txtNoLogo.classList.add('hidden');
            };
        }
    }

    updateSettingsUI() {
        document.querySelectorAll('.btn-size').forEach(b => b.classList.toggle('btn-active', b.dataset.size === this.state.settings.textSize));
        document.querySelectorAll('.btn-pos').forEach(b => {
            let target = this.state.settings.textPos;
            if (b.dataset.type === 'text') {
                target = this.state.settings.textPos;
            } else if (b.dataset.type === 'logo') {
                target = this.state.settings.logoPos;
            } else if (b.dataset.type === 'qr') {
                target = this.state.settings.qrCodePos;
            }
            b.classList.toggle('btn-active', b.dataset.pos === target);
        });
        
        // Update status toggle QR code
        const qrToggle = document.getElementById('toggle-qr-code');
        if (qrToggle) {
            qrToggle.checked = this.state.settings.qrCodeEnabled;
        }
    }

    loadSettings() {
        this.dom.inpProject.value = this.state.settings.projName;
        this.dom.inpNote.value = this.state.settings.projNote;
        const savedLogo = localStorage.getItem('gc_logoImg');
        if (savedLogo) this.loadLogo(savedLogo);
        this.updateSettingsUI(); // Memastikan toggle QR code juga diinisialisasi
    }

    startClock() {
        setInterval(() => {
            const now = new Date();
            this.dom.lblTime.innerText = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ' • ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' });
        }, 1000);
    }

    // (BARU v6.4) Membuat dan inject Manifest + Ikon PWA
    initPWA() {
        // 1. Buat Ikon (SVG sederhana sebagai Data URL)
        const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" fill="#2563EB" viewBox="0 0 256 256"><path d="M208,56H180.28L166.65,35.55A16,16,0,0,0,152.84,28H103.16a16,16,0,0,0-13.81,7.55L75.72,56H48A24,24,0,0,0,24,80V200a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V80A24,24,0,0,0,208,56Zm16,144a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H80a16,16,0,0,0,13.81-7.55L107.45,44h41.1l13.64,20.45A16,16,0,0,0,176,72h32a8,8,0,0,1,8,8ZM128,96a40,40,0,1,0,40,40A40,40,0,0,0,128,96Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,160Z"></path></svg>`;
        const iconUrl = 'data:image/svg+xml;base64,' + btoa(svgIcon);

        // 2. Buat Manifest
        const manifest = {
            "name": "Geo Camera Pro",
            "short_name": "Geo Cam",
            "description": "Aplikasi Kamera Geo dengan Watermark GPS dan Logo Kustom",
            "start_url": ".",
            "display": "standalone",
            "background_color": "#000000",
            "theme_color": "#000000",
            "icons": [
                { "src": iconUrl, "sizes": "192x192", "type": "image/svg+xml" },
                { "src": iconUrl, "sizes": "512x512", "type": "image/svg+xml" }
            ]
        };
        const manifestUrl = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));

        // 3. Inject ke <head>
        document.querySelector('link[rel="manifest"]').href = manifestUrl;
        document.querySelector('link[rel="apple-touch-icon"]').href = iconUrl;
    }
}