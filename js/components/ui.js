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
                if (this.dom.modals && !this.dom.modals.gallery.classList.contains('hidden')) {
                    this.galleryController.load();
                }
            });
        });

        // Subscribe ke event gallery load requested
        this.eventBus.subscribe('gallery:loadRequested', (callback) => {
            this.storageService.getAll(callback);
        });

        // Subscribe ke event untuk delete selected photos dari gallery controller
        this.eventBus.subscribe('gallery:deleteSelected', (data) => {
            this.confirm(`Hapus ${data.count} foto terpilih?`, data.callback);
        });

        // Subscribe ke event zoom change
        this.eventBus.subscribe('zoom:changed', (zoomLevel) => {
            this.updateZoomUI(zoomLevel);
        });

        // Subscribe to modal open events
        this.eventBus.subscribe('gallery:opened', () => {
            this.registerModalOpen('gallery');
        });

        this.eventBus.subscribe('preview:opened', () => {
            this.registerModalOpen('preview');
        });

        this.eventBus.subscribe('settings:opened', () => {
            this.registerModalOpen('settings');
        });
        
        // Subscribe to photo deleted event to update gallery thumbnail
        this.eventBus.subscribe('photo:deleted', () => {
            if (this.storageService) {
                this.storageService.loadLastThumb();
            }
        });
        
        // Subscribe to gallery cleared event to update gallery thumbnail
        this.eventBus.subscribe('gallery:cleared', () => {
            if (this.storageService) {
                this.storageService.loadLastThumb();
            }
        });
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
            // Emit event to notify that settings modal is opened
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
            if (this.confirm && this.storageService && this.galleryController) {
                this.confirm("Hapus SEMUA foto?", () => {
                    this.storageService.clearAll(() => {
                        if (this.galleryController) this.galleryController.load();
                    });
                });
            }
        };

        const btnShareSelected = document.getElementById('btn-share-selected');
        if (btnShareSelected) btnShareSelected.onclick = () => {
            if (this.galleryController) {
                this.galleryController.shareSelectedItems();
            }
        };

        const btnShareSelectedMultiple = document.getElementById('btn-share-selected-multiple');
        if (btnShareSelectedMultiple) btnShareSelectedMultiple.onclick = () => {
            if (this.galleryController) {
                this.galleryController.shareSelectedItems();
            }
        };

        const btnDeleteSelected = document.getElementById('btn-delete-selected');
        if (btnDeleteSelected) btnDeleteSelected.onclick = () => {
            if (this.galleryController) {
                this.galleryController.deleteSelectedItems();
            }
        };

        // Initialize zoom UI with current zoom level
        setTimeout(() => {
            if (this.cameraService && this.cameraService.state) {
                this.updateZoomUI(this.cameraService.state.zoomLevel);
            }
        }, 0);

        const btnCancelSelection = document.getElementById('btn-cancel-selection');
        if (btnCancelSelection) btnCancelSelection.onclick = () => {
            if (this.galleryController) {
                this.galleryController.exitSelectionMode();
            }
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
            if (this.confirm && this.storageService && this.previewController && this.galleryController) {
                this.confirm("Hapus foto ini?", () => {
                    this.storageService.delete(this.state.currentPhotoId, () => {
                        if (this.previewController) this.previewController.close();
                        if (this.galleryController) this.galleryController.load();
                        if (this.storageService) this.storageService.loadLastThumb();
                    });
                });
            }
        };

        const btnShare = document.getElementById('btn-share');
        if (btnShare) btnShare.onclick = () => {
            if (this.previewController) {
                this.previewController.share();
            }
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
                            // Swipe kiri - ke foto berikutnya
                            this.previewController.next();
                        } else {
                            // Swipe kanan - ke foto sebelumnya
                            this.previewController.prev();
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
            this.utils.updateSetting(this.state.settings, 'projName', e.target.value);
        };
        if (this.dom.inpNote) this.dom.inpNote.oninput = (e) => {
            this.utils.updateSetting(this.state.settings, 'projNote', e.target.value);
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

        // Use classList for all buttons with the same class
        const btnSizeElements = document.querySelectorAll('.btn-size');
        btnSizeElements.forEach(btn => btn.onclick = () => {
            this.utils.updateSetting(this.state.settings, 'textSize', btn.dataset.size);
            this.updateSettingsUI();
        });

        const btnPosElements = document.querySelectorAll('.btn-pos');
        btnPosElements.forEach(btn => btn.onclick = () => {
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

        // Event listeners untuk export/import settings
        const btnExportSettings = document.getElementById('btn-export-settings');
        if (btnExportSettings) {
            btnExportSettings.onclick = () => {
                this.utils.exportSettings(this.state.settings);
            };
        }

        const btnImportSettings = document.getElementById('btn-import-settings');
        if (btnImportSettings) {
            btnImportSettings.onclick = () => {
                // Trigger the hidden file input
                const fileInput = document.getElementById('inp-import-settings');
                if (fileInput) {
                    fileInput.click();
                }
            };
        }

        const inpImportSettings = document.getElementById('inp-import-settings');
        if (inpImportSettings) {
            inpImportSettings.onchange = (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.importSettings(e.target.files[0]);
                }
            };
        }
    }

    confirm(msg, cb) {
        const lblConfirmMsg = document.getElementById('lbl-confirm-msg');
        if (lblConfirmMsg) {
            lblConfirmMsg.innerText = msg;
        }
        this.state.confirmCallback = cb;
        if (this.dom.modals) this.dom.modals.confirm.classList.remove('hidden');
    }

    loadLogo(src) {
        if (!src) {
            this.state.customLogoImg = null;
            if (this.dom.previewLogo) {
                this.dom.previewLogo.classList.add('hidden');
            }
            if (this.dom.txtNoLogo) {
                this.dom.txtNoLogo.classList.remove('hidden');
            }
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
        const btnSizeElements = document.querySelectorAll('.btn-size');
        btnSizeElements.forEach(b => {
            if (b.classList) {
                b.classList.toggle('btn-active', b.dataset.size === this.state.settings.textSize);
            }
        });

        const btnPosElements = document.querySelectorAll('.btn-pos');
        btnPosElements.forEach(b => {
            let target = this.state.settings.textPos;
            if (b.dataset.type === 'text') {
                target = this.state.settings.textPos;
            } else if (b.dataset.type === 'logo') {
                target = this.state.settings.logoPos;
            } else if (b.dataset.type === 'qr') {
                target = this.state.settings.qrCodePos;
            }
            if (b.classList) {
                b.classList.toggle('btn-active', b.dataset.pos === target);
            }
        });

        // Update status toggle QR code
        const qrToggle = document.getElementById('toggle-qr-code');
        if (qrToggle) {
            qrToggle.checked = this.state.settings.qrCodeEnabled;
        }
    }

    loadSettings() {
        if (this.dom.inpProject) this.dom.inpProject.value = this.state.settings.projName;
        if (this.dom.inpNote) this.dom.inpNote.value = this.state.settings.projNote;
        const savedLogo = localStorage.getItem('gc_logoImg');
        if (savedLogo) this.loadLogo(savedLogo);
        this.updateSettingsUI(); // Memastikan toggle QR code juga diinisialisasi
    }

    /**
     * Import settings from a JSON file
     * @param {File} file - The settings file to import
     */
    async importSettings(file) {
        try {
            this.utils.importSettings(file, (error, importData) => {
                if (error) {
                    console.error('Error importing settings:', error);
                    if (this.notificationService) {
                        this.notificationService.show(`Error importing settings: ${error.message}`, 'error', 5000);
                    } else {
                        alert(`Error importing settings: ${error.message}`);
                    }
                    return;
                }

                // Validate the import data
                const { settings: importedSettings, logo: logoData, version } = importData;

                // Update the state with imported settings
                Object.keys(importedSettings).forEach(key => {
                    if (this.state.settings.hasOwnProperty(key)) {
                        // Handle the special case where boolean values might be stored as strings in JSON
                        let valueToSet = importedSettings[key];
                        if (key === 'qrCodeEnabled') {
                            // Convert string to boolean if needed
                            if (typeof importedSettings[key] === 'string') {
                                valueToSet = importedSettings[key] === 'true';
                            } else {
                                valueToSet = Boolean(importedSettings[key]);
                            }
                        }

                        this.state.settings[key] = valueToSet;

                        // Update localStorage with the imported value
                        const stringValue = typeof valueToSet === 'boolean' ?
                            String(valueToSet) : valueToSet;
                        localStorage.setItem(`gc_${key}`, stringValue);
                    }
                });

                // Restore the logo if it was included in the import
                if (logoData) {
                    localStorage.setItem('gc_logoImg', logoData);

                    // Load the logo into the DOM
                    this.loadLogo(logoData);
                }

                // Update UI to reflect the imported settings
                this.updateAllSettingsUI();

                // Show success notification
                if (this.notificationService) {
                    this.notificationService.show('Settings imported successfully!', 'success', 3000);
                } else {
                    alert('Settings imported successfully!');
                }

                console.log('Settings imported successfully', importData);
            });
        } catch (error) {
            console.error('Error during settings import:', error);
            if (this.notificationService) {
                this.notificationService.show(`Error importing settings: ${error.message}`, 'error', 5000);
            } else {
                alert(`Error importing settings: ${error.message}`);
            }
        }
    }

    /**
     * Update all UI elements to reflect the current settings state
     */
    updateAllSettingsUI() {
        // Update project name and note inputs if they exist
        if (this.dom.inpProject) this.dom.inpProject.value = this.state.settings.projName;
        if (this.dom.inpNote) this.dom.inpNote.value = this.state.settings.projNote;

        // Update text size buttons
        document.querySelectorAll('.btn-size').forEach(btn => {
            btn.classList.toggle('text-white', btn.dataset.size === this.state.settings.textSize);
            btn.classList.toggle('bg-blue-600', btn.dataset.size === this.state.settings.textSize);
            btn.classList.toggle('bg-gray-800', btn.dataset.size !== this.state.settings.textSize);
        });

        // Update position buttons for text
        document.querySelectorAll('.btn-pos[data-type="text"]').forEach(btn => {
            btn.classList.toggle('text-white', btn.dataset.pos === this.state.settings.textPos);
            btn.classList.toggle('bg-blue-600', btn.dataset.pos === this.state.settings.textPos);
            btn.classList.toggle('bg-gray-800', btn.dataset.pos !== this.state.settings.textPos);
        });

        // Update position buttons for logo
        document.querySelectorAll('.btn-pos[data-type="logo"]').forEach(btn => {
            btn.classList.toggle('text-white', btn.dataset.pos === this.state.settings.logoPos);
            btn.classList.toggle('bg-blue-600', btn.dataset.pos === this.state.settings.logoPos);
            btn.classList.toggle('bg-gray-800', btn.dataset.pos !== this.state.settings.logoPos);
        });

        // Update position buttons for QR code
        document.querySelectorAll('.btn-pos[data-type="qr"]').forEach(btn => {
            btn.classList.toggle('text-white', btn.dataset.pos === this.state.settings.qrCodePos);
            btn.classList.toggle('bg-blue-600', btn.dataset.pos === this.state.settings.qrCodePos);
            btn.classList.toggle('bg-gray-800', btn.dataset.pos !== this.state.settings.qrCodePos);
        });

        // Update QR code toggle
        const qrToggle = document.getElementById('toggle-qr-code');
        if (qrToggle) {
            qrToggle.checked = this.state.settings.qrCodeEnabled;
        }

        // Reload settings UI
        this.updateSettingsUI();
    }

    updateZoomUI(currentZoomLevel) {
        // Remove active class from all zoom buttons
        const zoomButtons = document.querySelectorAll('.zoom-btn');
        zoomButtons.forEach(btn => btn.classList.remove('active'));

        // Format the zoom level to match button IDs (e.g., 1, 2, 4, 8, 10)
        // First, check if it's an exact match for our predefined levels
        const availableLevels = [1, 2, 4, 8, 10];
        let matchedLevel = null;

        // Check for exact match first
        for (const level of availableLevels) {
            if (currentZoomLevel === level) {
                matchedLevel = level;
                break;
            }
        }

        // If no exact match, find the closest level (with some tolerance for floating point errors)
        if (matchedLevel === null) {
            matchedLevel = availableLevels.reduce((prev, curr) =>
                Math.abs(curr - currentZoomLevel) < Math.abs(prev - currentZoomLevel) ? curr : prev
            );
        }

        // Add active class to the current zoom level button
        const activeButtonId = `btn-zoom-${matchedLevel}x`;
        const activeButton = document.getElementById(activeButtonId);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    startClock() {
        setInterval(() => {
            const now = new Date();
            if (this.dom.lblTime) {
                this.dom.lblTime.innerText = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ' • ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' });
            }
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
        const manifestLink = document.querySelector('link[rel="manifest"]');
        const appleIconLink = document.querySelector('link[rel="apple-touch-icon"]');

        if (manifestLink) manifestLink.href = manifestUrl;
        if (appleIconLink) appleIconLink.href = iconUrl;

    }

    // Handle back button navigation
    initBackButtonHandler() {
        // Add event listener for the back button
        window.addEventListener('popstate', (event) => {
            this.handleBackButton(event);
        });

        // Override the default back button behavior by pushing initial state
        history.replaceState({ page: 'main' }, '', location.href);
    }

    // Handle back button press based on current modal state
    handleBackButton(event) {
        // Check if there are modals open, close them in reverse order of opening
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
            // If in selection mode, exit selection mode first
            if (this.galleryController && this.galleryController.isInSelectionMode()) {
                this.galleryController.exitSelectionMode();
                return;
            } else {
                this.galleryController.close();
                return;
            }
        }

        if (this.isModalOpen('settings')) {
            this.closeModal('settings');
            return;
        }

        // If we're back to the main view and the event state is for main,
        // push a new state to prevent the app from exiting
        if (event.state && event.state.page === 'main') {
            history.pushState({ page: 'main' }, '', location.href);
        }
    }

    // Helper function to check if a modal is open
    isModalOpen(modalName) {
        if (!this.dom.modals || !this.dom.modals[modalName]) {
            return false;
        }
        return !this.dom.modals[modalName].classList.contains('hidden');
    }

    // Helper function to close a modal
    closeModal(modalName) {
        if (this.dom.modals && this.dom.modals[modalName]) {
            this.dom.modals[modalName].classList.add('hidden');
        }
    }

    // Method to be called when a modal is opened to add to history
    registerModalOpen(modalName) {
        // Push state to browser history to handle back button
        history.pushState({ page: modalName }, '', location.href);
    }
}