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

        // --- Event Subscriptions ---

        // Listen for storage readiness to load the initial thumbnail
        this.eventBus.subscribe('storage:initialized', () => this.updateGalleryThumbnail());

        // Update thumbnail whenever a photo is saved or deleted
        this.eventBus.subscribe('photo:saved', () => this.updateGalleryThumbnail());
        this.eventBus.subscribe('photo:deleted', () => this.updateGalleryThumbnail());
        this.eventBus.subscribe('gallery:cleared', () => this.updateGalleryThumbnail());

        // Listen for the gallery's request to load photos
        this.eventBus.subscribe('gallery:loadRequested', async (callback) => {
            try {
                const photos = await this.storageService.getAll();
                callback(photos);
            } catch (error) {
                console.error("Failed to get all photos:", error);
                callback([]); // Return empty array on error
            }
        });

        // Listen for a request from the gallery to delete multiple items
        this.eventBus.subscribe('gallery:deleteSelected', (data) => {
            this.confirm(`Hapus ${data.count} foto terpilih?`, data.callback);
        });

        // Update UI based on zoom changes from the camera service
        this.eventBus.subscribe('zoom:changed', (zoomLevel) => this.updateZoomUI(zoomLevel));

        // Register modal openings to handle back button navigation
        this.eventBus.subscribe('gallery:opened', () => this.registerModalOpen('gallery'));
        this.eventBus.subscribe('preview:opened', () => this.registerModalOpen('preview'));
        this.eventBus.subscribe('settings:opened', () => this.registerModalOpen('settings'));
        
        // Detect and log if it's a low-end device
        if (this.isLowEndDevice()) {
            console.log("Perangkat rendah terdeteksi, menyesuaikan pengaturan untuk kinerja optimal");
        }

        // Create debounced versions of the settings update functions
        this.debouncedUpdateProjectName = this.utils.debounce((value) => this.utils.updateSetting(this.state.settings, 'projName', value), 400);
        this.debouncedUpdateProjectNote = this.utils.debounce((value) => this.utils.updateSetting(this.state.settings, 'projNote', value), 400);
    }

    async updateGalleryThumbnail() {
        try {
            const lastPhoto = await this.storageService.getLastPhoto();
            const { imgThumb, iconGallery } = this.dom;

            if (imgThumb && iconGallery) {
                if (lastPhoto) {
                    imgThumb.src = lastPhoto.data;
                    imgThumb.classList.remove('hidden');
                    iconGallery.classList.add('hidden');
                } else {
                    imgThumb.classList.add('hidden');
                    iconGallery.classList.remove('hidden');
                }
            }
        } catch (error) {
            console.error("Failed to update gallery thumbnail:", error);
        }
    }

    initListeners() {
        if (this.dom.btnShutter) this.dom.btnShutter.onclick = () => this.cameraService.shutter();
        if (this.dom.btnSwitch) this.dom.btnSwitch.onclick = () => this.cameraService.switch();
        if (this.dom.btnFlash) this.dom.btnFlash.onclick = () => this.cameraService.toggleFlash();

        // Zoom buttons event listeners
        const zoomButtons = {
            'btn-zoom-1x': 1.0,
            'btn-zoom-2x': 2.0,
            'btn-zoom-4x': 4.0,
            'btn-zoom-8x': 8.0,
            'btn-zoom-10x': 10.0
        };

        Object.entries(zoomButtons).forEach(([buttonId, zoomLevel]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.onclick = async () => {
                    if (this.cameraService) {
                        await this.cameraService.setZoom(zoomLevel);
                        this.updateZoomUI(zoomLevel);
                    }
                };
            }
        });

        if (this.dom.btnGallery) this.dom.btnGallery.onclick = () => this.galleryController.open();
        
        if (this.dom.btnSettings) this.dom.btnSettings.onclick = () => {
            if (this.dom.modals) this.dom.modals.settings.classList.remove('hidden');
            this.eventBus.emit('settings:opened');
        };

        const btnCloseSettings = document.getElementById('btn-close-settings');
        if (btnCloseSettings) btnCloseSettings.onclick = () => {
            if (this.dom.modals) this.dom.modals.settings.classList.add('hidden');
        };

        const btnCloseGallery = document.getElementById('btn-close-gallery');
        if (btnCloseGallery) btnCloseGallery.onclick = () => {
            if (this.galleryController) this.galleryController.close();
        };

        const btnDeleteAll = document.getElementById('btn-delete-all');
        if (btnDeleteAll) btnDeleteAll.onclick = () => {
            this.confirm("Hapus SEMUA foto?", async () => {
                try {
                    await this.storageService.clearAll();
                    if (this.galleryController) this.galleryController.load();
                } catch (error) {
                    console.error("Failed to clear all photos:", error);
                }
            });
        };

        const btnShareSelected = document.getElementById('btn-share-selected');
        if (btnShareSelected) btnShareSelected.onclick = () => {
            if (this.galleryController) this.galleryController.shareSelectedItems();
        };

        const btnShareSelectedMultiple = document.getElementById('btn-share-selected-multiple');
        if (btnShareSelectedMultiple) btnShareSelectedMultiple.onclick = () => {
            if (this.galleryController) this.galleryController.shareSelectedItems();
        };

        const btnDeleteSelected = document.getElementById('btn-delete-selected');
        if (btnDeleteSelected) btnDeleteSelected.onclick = () => {
            if (this.galleryController) this.galleryController.deleteSelectedItems();
        };

        // Initialize zoom UI with current zoom level
        setTimeout(() => {
            if (this.cameraService && this.cameraService.state) {
                this.updateZoomUI(this.cameraService.state.zoomLevel);
            }
        }, 0);

        const btnCancelSelection = document.getElementById('btn-cancel-selection');
        if (btnCancelSelection) btnCancelSelection.onclick = () => {
            if (this.galleryController) this.galleryController.exitSelectionMode();
        };

        const btnClosePreview = document.getElementById('btn-close-preview');
        if (btnClosePreview) btnClosePreview.onclick = () => {
            if (this.previewController) this.previewController.close();
        };

        const btnDownload = document.getElementById('btn-download');
        if (btnDownload) btnDownload.onclick = () => {
            if (this.previewController) this.previewController.download();
        };

        const btnDeleteOne = document.getElementById('btn-delete-one');
        if (btnDeleteOne) btnDeleteOne.onclick = () => {
            this.confirm("Hapus foto ini?", async () => {
                try {
                    await this.storageService.delete(this.state.currentPhotoId);
                    if (this.previewController) this.previewController.close();
                    if (this.galleryController) this.galleryController.load();
                } catch (error) {
                    console.error(`Failed to delete photo ${this.state.currentPhotoId}:`, error);
                }
            });
        };

        const btnShare = document.getElementById('btn-share');
        if (btnShare) btnShare.onclick = () => {
            if (this.previewController) this.previewController.share();
        };

        // Setup swipe gestures for photo navigation in preview modal
        if (this.dom.modals.preview) {
            let startX = 0;
            let startY = 0;

            this.dom.modals.preview.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }, { passive: true });

            this.dom.modals.preview.addEventListener('touchend', (e) => {
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                
                const diffX = startX - endX;
                const diffY = startY - endY;
                
                // Cek apakah gerakan utamanya horizontal
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
                    if (this.previewController && this.previewController.currentPhotos && this.previewController.currentPhotos.length > 0) {
                        if (diffX > 0) {
                            this.previewController.next(); // Swipe left
                        } else {
                            this.previewController.prev(); // Swipe right
                        }
                    }
                }
            }, { passive: true });
        }

        const btnConfirmNo = document.getElementById('btn-confirm-no');
        if (btnConfirmNo) btnConfirmNo.onclick = () => {
            if (this.dom.modals) this.dom.modals.confirm.classList.add('hidden');
        };

        const btnConfirmYes = document.getElementById('btn-confirm-yes');
        if (btnConfirmYes) btnConfirmYes.onclick = () => {
            if(this.state.confirmCallback) this.state.confirmCallback();
            if (this.dom.modals) this.dom.modals.confirm.classList.add('hidden');
        };

        if (this.dom.inpProject) this.dom.inpProject.oninput = (e) => {
            this.debouncedUpdateProjectName(e.target.value);
        };
        if (this.dom.inpNote) this.dom.inpNote.oninput = (e) => {
            this.debouncedUpdateProjectNote(e.target.value);
        };
        if (this.dom.inpLogo) this.dom.inpLogo.onchange = (e) => {
            if (e.target.files[0]) {
                const r = new FileReader();
                r.onload = (ev) => {
                    localStorage.setItem('gc_logoImg', ev.target.result);
                    this.loadLogo(ev.target.result);
                };
                r.readAsDataURL(e.target.files[0]);
            }
        };

        const btnClearLogo = document.getElementById('btn-clear-logo');
        if (btnClearLogo) btnClearLogo.onclick = () => this.confirm("Hapus logo?", () => {
            localStorage.removeItem('gc_logoImg');
            this.loadLogo(null);
            if (this.dom.inpLogo) this.dom.inpLogo.value = '';
        });

        document.querySelectorAll('.btn-size').forEach(btn => btn.onclick = () => {
            this.utils.updateSetting(this.state.settings, 'textSize', btn.dataset.size);
            this.updateSettingsUI();
        });

        document.querySelectorAll('.btn-pos').forEach(btn => btn.onclick = () => {
            const type = btn.dataset.type;
            const pos = btn.dataset.pos;
            if (type === 'text') this.utils.updateSetting(this.state.settings, 'textPos', pos);
            else if (type === 'logo') this.utils.updateSetting(this.state.settings, 'logoPos', pos);
            else if (type === 'qr') this.utils.updateSetting(this.state.settings, 'qrCodePos', pos);
            this.updateSettingsUI();
        });

        const qrToggle = document.getElementById('toggle-qr-code');
        if (qrToggle) {
            qrToggle.onchange = (e) => {
                this.utils.updateSetting(this.state.settings, 'qrCodeEnabled', e.target.checked);
            };
        }

        const btnExportSettings = document.getElementById('btn-export-settings');
        if (btnExportSettings) {
            btnExportSettings.onclick = () => this.utils.exportSettings(this.state.settings);
        }

        const btnImportSettings = document.getElementById('btn-import-settings');
        if (btnImportSettings) {
            btnImportSettings.onclick = () => document.getElementById('inp-import-settings')?.click();
        }

        const inpImportSettings = document.getElementById('inp-import-settings');
        if (inpImportSettings) {
            inpImportSettings.onchange = (e) => {
                if (e.target.files?.[0]) this.importSettings(e.target.files[0]);
            };
        }
    }

    confirm(msg, cb) {
        const lblConfirmMsg = document.getElementById('lbl-confirm-msg');
        if (lblConfirmMsg) lblConfirmMsg.innerText = msg;
        this.state.confirmCallback = cb;
        if (this.dom.modals) this.dom.modals.confirm.classList.remove('hidden');
    }

    loadLogo(src) {
        if (!src) {
            this.state.customLogoImg = null;
            if (this.dom.previewLogo) this.dom.previewLogo.classList.add('hidden');
            if (this.dom.txtNoLogo) this.dom.txtNoLogo.classList.remove('hidden');
        } else {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                this.state.customLogoImg = img;
                if (this.dom.previewLogo) {
                    this.dom.previewLogo.src = src;
                    this.dom.previewLogo.classList.remove('hidden');
                    this.dom.txtNoLogo.classList.add('hidden');
                }
            };
        }
    }

    updateSettingsUI() {
        document.querySelectorAll('.btn-size').forEach(b => 
            b.classList.toggle('btn-active', b.dataset.size === this.state.settings.textSize)
        );

        document.querySelectorAll('.btn-pos').forEach(b => {
            const type = b.dataset.type;
            let target;
            if (type === 'text') target = this.state.settings.textPos;
            else if (type === 'logo') target = this.state.settings.logoPos;
            else if (type === 'qr') target = this.state.settings.qrCodePos;
            b.classList.toggle('btn-active', b.dataset.pos === target);
        });

        const qrToggle = document.getElementById('toggle-qr-code');
        if (qrToggle) qrToggle.checked = this.state.settings.qrCodeEnabled;
    }

    loadSettings() {
        if (this.dom.inpProject) this.dom.inpProject.value = this.state.settings.projName;
        if (this.dom.inpNote) this.dom.inpNote.value = this.state.settings.projNote;
        const savedLogo = localStorage.getItem('gc_logoImg');
        if (savedLogo) this.loadLogo(savedLogo);
        this.updateSettingsUI();
    }

    importSettings(file) {
        this.utils.importSettings(file, (error, importData) => {
            if (error) {
                console.error('Error importing settings:', error);
                this.eventBus.emit('notification:show', { message: `Error: ${error.message}`, type: 'error' });
                return;
            }

            const { settings: importedSettings, logo: logoData } = importData;
            Object.keys(importedSettings).forEach(key => {
                if (this.state.settings.hasOwnProperty(key)) {
                    let value = importedSettings[key];
                    if (key === 'qrCodeEnabled') value = String(value) === 'true';
                    this.utils.updateSetting(this.state.settings, key, value);
                }
            });

            if (logoData) {
                localStorage.setItem('gc_logoImg', logoData);
                this.loadLogo(logoData);
            }

            this.updateAllSettingsUI();
            this.eventBus.emit('notification:show', { message: 'Settings imported successfully!', type: 'success' });
        });
    }

    updateAllSettingsUI() {
        if (this.dom.inpProject) this.dom.inpProject.value = this.state.settings.projName;
        if (this.dom.inpNote) this.dom.inpNote.value = this.state.settings.projNote;
        this.updateSettingsUI();
    }

    updateZoomUI(currentZoomLevel) {
        document.querySelectorAll('.zoom-btn').forEach(btn => btn.classList.remove('active'));
        const availableLevels = [1, 2, 4, 8, 10];
        const closestLevel = availableLevels.reduce((prev, curr) => 
            Math.abs(curr - currentZoomLevel) < Math.abs(prev - currentZoomLevel) ? curr : prev
        );
        const activeButton = document.getElementById(`btn-zoom-${closestLevel}x`);
        if (activeButton) activeButton.classList.add('active');
    }

    startClock() {
        setInterval(() => {
            const now = new Date();
            if (this.dom.lblTime) {
                this.dom.lblTime.innerText = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) + ' • ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' });
            }
        }, 1000);
    }

    initPWA() {
        const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" fill="#2563EB" viewBox="0 0 256 256"><path d="M208,56H180.28L166.65,35.55A16,16,0,0,0,152.84,28H103.16a16,16,0,0,0-13.81,7.55L75.72,56H48A24,24,0,0,0,24,80V200a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V80A24,24,0,0,0,208,56Zm16,144a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H80a16,16,0,0,0,13.81-7.55L107.45,44h41.1l13.64,20.45A16,16,0,0,0,176,72h32a8,8,0,0,1,8,8ZM128,96a40,40,0,1,0,40,40A40,40,0,0,0,128,96Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,160Z"></path></svg>`;
        const iconUrl = 'data:image/svg+xml;base64,' + btoa(svgIcon);
        const manifest = {
            "name": "Geo Camera Pro", "short_name": "Geo Cam", "description": "Aplikasi Kamera Geo dengan Watermark GPS dan Logo Kustom", "start_url": ".", "display": "standalone", "background_color": "#000000", "theme_color": "#000000",
            "icons": [ { "src": iconUrl, "sizes": "192x192", "type": "image/svg+xml" }, { "src": iconUrl, "sizes": "512x512", "type": "image/svg+xml" } ]
        };
        const manifestUrl = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));
        const manifestLink = document.querySelector('link[rel="manifest"]');
        const appleIconLink = document.querySelector('link[rel="apple-touch-icon"]');
        if (manifestLink) manifestLink.href = manifestUrl;
        if (appleIconLink) appleIconLink.href = iconUrl;
    }

    initBackButtonHandler() {
        window.addEventListener('popstate', (event) => this.handleBackButton(event));
        history.replaceState({ page: 'main' }, '', location.href);
    }

    handleBackButton(event) {
        if (this.isModalOpen('confirm')) {
            this.closeModal('confirm');
            history.pushState({ page: 'main' }, '', location.href);
            return;
        }
        if (this.isModalOpen('preview')) {
            this.previewController.close();
            return;
        }
        if (this.isModalOpen('gallery')) {
            if (this.galleryController?.isInSelectionMode()) {
                this.galleryController.exitSelectionMode();
            } else {
                this.galleryController.close();
            }
            return;
        }
        if (this.isModalOpen('settings')) {
            this.closeModal('settings');
            return;
        }
        if (event.state?.page === 'main') {
            history.pushState({ page: 'main' }, '', location.href);
        }
    }

    isModalOpen(modalName) {
        return this.dom.modals?.[modalName] && !this.dom.modals[modalName].classList.contains('hidden');
    }

    closeModal(modalName) {
        if (this.dom.modals?.[modalName]) {
            this.dom.modals[modalName].classList.add('hidden');
        }
    }

    registerModalOpen(modalName) {
        history.pushState({ page: modalName }, '', location.href);
    }

    isLowEndDevice() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
        const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
        const slowConnection = conn && (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g');
        return lowMemory || lowCores || slowConnection;
    }
}