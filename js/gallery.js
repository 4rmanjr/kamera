/**
 * Gallery Controller Module
 * Mengelola fungsionalitas galeri foto dengan virtual scrolling
 */

import { VirtualGallery } from './virtualGallery.js';

export class GalleryController {
    constructor({ state, dom, previewController, storageService, eventBus }) {
        this.state = state;
        this.dom = dom;
        this.previewController = previewController;  // Akan di-set nanti setelah instance dibutuhkan
        this.storageService = storageService;
        this.eventBus = eventBus;
        this.virtualGallery = null;
        this.selectedItems = new Set();  // Track selected items
        this.isSelectionMode = false;    // Track selection mode
        this.currentPhotos = [];  // Cache foto terbaru
    }

    enterSelectionMode() {
        this.isSelectionMode = true;
        this.selectedItems.clear();
        this.updateHeaderDisplay();
        this.updateSelectionCounts();
    }

    exitSelectionMode() {
        this.isSelectionMode = false;
        this.selectedItems.clear();
        this.updateHeaderDisplay();
        this.updateSelectionCounts();
    }

    toggleItemSelection(item) {
        if (this.selectedItems.has(item.id)) {
            this.selectedItems.delete(item.id);
        } else {
            this.selectedItems.add(item.id);
        }
        this.updateSelectionCounts();
        this.updateItemSelectionUI(item);
    }

    updateHeaderDisplay() {
        const normalHeader = this.dom.galleryHeaderNormal;
        const selectedHeader = this.dom.galleryHeaderSelected;

        if (this.isSelectionMode) {
            if (normalHeader) normalHeader.classList.add('hidden');
            if (selectedHeader) selectedHeader.classList.remove('hidden');
        } else {
            if (normalHeader) normalHeader.classList.remove('hidden');
            if (selectedHeader) selectedHeader.classList.add('hidden');
        }
    }

    updateSelectionCounts() {
        const selectedCountLabel = this.dom.lblSelectedCount;
        const shareSelectedBtn = this.dom.btnShareSelectedMultiple;
        const deleteSelectedBtn = this.dom.btnDeleteSelected;

        if (selectedCountLabel) {
            selectedCountLabel.innerText = `${this.selectedItems.size} dipilih`;
        }

        if (shareSelectedBtn) {
            shareSelectedBtn.disabled = this.selectedItems.size === 0;
            shareSelectedBtn.classList.toggle('opacity-50', this.selectedItems.size === 0);
        }

        if (deleteSelectedBtn) {
            deleteSelectedBtn.disabled = this.selectedItems.size === 0;
            deleteSelectedBtn.classList.toggle('opacity-50', this.selectedItems.size === 0);
        }
    }

    updateItemSelectionUI(item) {
        // Find the element in the gallery grid that corresponds to this item
        const allItems = this.dom.galleryGrid.querySelectorAll('.gallery-item');
        allItems.forEach(el => {
            if (el.dataset.itemId === item.id.toString()) {
                const isSelected = this.selectedItems.has(item.id);
                el.classList.toggle('ring-4', isSelected);
                el.classList.toggle('ring-green-500', isSelected);

                // Add or remove selection indicator
                let indicator = el.querySelector('.selection-indicator');
                if (isSelected) {
                    if (!indicator) {
                        indicator = document.createElement('div');
                        indicator.className = 'selection-indicator absolute top-2 right-2 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center z-10';
                        indicator.innerHTML = '<i class="ph ph-check text-white text-sm"></i>';
                        el.appendChild(indicator);
                    }
                } else if (indicator) {
                    indicator.remove();
                }
            }
        });
    }

    resetAllSelections() {
        this.selectedItems.clear();
        const allItems = this.dom.galleryGrid.querySelectorAll('.gallery-item');
        allItems.forEach(el => {
            el.classList.remove('ring-4', 'ring-green-500');
            const indicator = el.querySelector('.selection-indicator');
            if (indicator) indicator.remove();
        });
        this.updateSelectionCounts();
    }

    async shareSelectedItems() {
        if (this.selectedItems.size === 0) return;

        try {
            // Gunakan foto dari cache lokal
            const allPhotos = this.currentPhotos;
            
            // Filter selected photos
            const selectedPhotos = allPhotos.filter(p => this.selectedItems.has(p.id));

            if (selectedPhotos.length === 0) {
                this.exitSelectionMode(); // Exit selection mode if no photos are selected
                return;
            }

            // Check if Web Share API supports sharing multiple files
            if (navigator.share && navigator.canShare) {
                // Convert selected photos to blob objects with proper types
                const files = [];

                // Process photos one by one to manage memory usage
                for (const photo of selectedPhotos) {
                    const response = await fetch(photo.data);
                    const blob = await response.blob();

                    // Determine the correct file type from the data URL
                    const mimeType = photo.data.split(',')[0].split(':')[1].split(';')[0];

                    // Extract extension from MIME type
                    let extension = 'jpg'; // default
                    if (mimeType === 'image/png') extension = 'png';
                    else if (mimeType === 'image/gif') extension = 'gif';
                    else if (mimeType === 'image/webp') extension = 'webp';
                    else if (mimeType === 'image/jpeg') extension = 'jpg';

                    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').substring(0, 15);
                    const file = new File([blob], `GeoCam_${timestamp}_share.${extension}`, { type: mimeType });
                    files.push(file);
                }

                // Check if the files can be shared
                if (navigator.canShare({ files })) {
                    await navigator.share({
                        title: `Bagikan ${selectedPhotos.length} foto`,
                        text: `Berikut adalah ${selectedPhotos.length} foto dari Geo Camera Pro`,
                        files: files
                    });
                } else {
                    console.log('Sharing these files is not supported by the Web Share API');
                    // Show notification that sharing is not supported
                    this.eventBus.emit('notification:show', {
                        message: 'Platform ini tidak mendukung pembagian file. Silakan gunakan tombol unduh.',
                        type: 'info'
                    });
                }
            } else {
                // Show notification that sharing is not supported
                console.log('Web Share API with file sharing not supported');
                this.eventBus.emit('notification:show', {
                    message: 'Platform ini tidak mendukung fitur berbagi. Silakan gunakan tombol unduh.',
                    type: 'info'
                });
            }

            // Exit selection mode after sharing (only if successful)
            this.exitSelectionMode();
        } catch (error) {
            console.error('Error sharing selected photos:', error);
            // Ensure selection mode is exited even if sharing fails
            this.exitSelectionMode();
        }
    }

    deleteSelectedItems() {
        if (this.selectedItems.size === 0) return;

        // Emit an event to UI controller to show the confirmation dialog
        this.eventBus.emit('gallery:deleteSelected', {
            count: this.selectedItems.size,
            callback: () => {
                const selectedPhotoIds = Array.from(this.selectedItems);

                // Delete each selected photo
                selectedPhotoIds.forEach(id => {
                    this.storageService.delete(id, () => {
                        // Remove from selection set
                        this.selectedItems.delete(id);
                    });
                });

                // Exit selection mode and refresh gallery
                this.exitSelectionMode();
                this.load();
            }
        });
    }

    setPreviewController(previewController) {
        this.previewController = previewController;
    }

    isInSelectionMode() {
        return this.isSelectionMode;
    }

    open() {
        if (this.dom.modals && this.dom.modals.gallery) {
            this.dom.modals.gallery.classList.remove('hidden');
            setTimeout(() => {
                if (this.dom.modals && this.dom.modals.gallery) {
                    this.dom.modals.gallery.classList.remove('translate-y-full');
                }
            }, 10);
        }
        this.load();

        // Emit event to notify UI controller that gallery is opened
        this.eventBus.emit('gallery:opened');
    }

    close() {
        if (this.virtualGallery) {
            this.virtualGallery.destroy();
            this.virtualGallery = null;
        }
        
        // Hapus observer jika ada
        if (this.state.galleryObserver) {
            this.state.galleryObserver.disconnect();
            this.state.galleryObserver = null;
        }
        
        if (this.dom.modals && this.dom.modals.gallery) {
            this.dom.modals.gallery.classList.add('translate-y-full');
            setTimeout(() => {
                if (this.dom.modals && this.dom.modals.gallery) {
                    this.dom.modals.gallery.classList.add('hidden');
                }
            }, 300);
        }
    }

    load() {
        // Hapus virtual gallery lama jika ada
        if (this.virtualGallery) {
            this.virtualGallery.destroy();
            this.virtualGallery = null;
        }

        // Kita perlu akses ke storage service melalui event
        this.eventBus.emit('gallery:loadRequested', (photos) => {
            // Simpan foto ke cache lokal
            this.currentPhotos = photos;
            
            const lblGalleryCount = this.dom.lblGalleryCount;
            if (lblGalleryCount) {
                lblGalleryCount.innerText = `(${photos.length})`;
            }

            if(photos.length === 0) {
                if (this.dom.galleryGrid) {
                    this.dom.galleryGrid.innerHTML = `<div class="col-span-3 flex flex-col items-center mt-20 text-gray-600"><i class="ph ph-images text-4xl mb-2" aria-hidden="true"></i><span class="text-sm">Galeri Kosong</span></div>`;
                }
                return;
            }

            // Gunakan virtual gallery untuk jumlah foto yang banyak
            if (photos.length > 50) { // Threshold untuk menggunakan virtual scrolling
                if (this.dom.galleryGrid) {
                    this.dom.galleryGrid.innerHTML = ''; // Kosongkan dulu
                }

                // Setup virtual gallery
                if (this.dom.galleryGrid) {
                    this.virtualGallery = new VirtualGallery(this.dom.galleryGrid, photos, {
                        itemHeight: 150, // Sesuaikan dengan ukuran gambar di grid
                        visibleBuffer: 10, // Jumlah buffer item
                        itemClass: 'aspect-square bg-gray-900 relative border border-gray-800 cursor-pointer overflow-hidden',
                        onItemSelect: (item, index) => {
                            this.previewController.open(item);
                        },
                        itemRenderer: (item, index) => {
                            const div = document.createElement('div');
                            div.className = 'aspect-square bg-gray-900 relative border border-gray-800 cursor-pointer overflow-hidden';
                            div.innerHTML = `<img data-src="${item.data}" class="w-full h-full object-cover opacity-0 transition-opacity duration-300" loading="lazy" alt="Foto galeri ${item.id}">`;
                            div.onclick = () => this.previewController.open(item);
                            return div;
                        }
                    });
                }
            } else {
                // Untuk jumlah foto sedikit, gunakan metode tradisional
                if (this.dom.galleryGrid) {
                    this.dom.galleryGrid.innerHTML = '';
                    const fragment = document.createDocumentFragment();

                    photos.forEach(p => {
                        const div = document.createElement('div');
                        div.className = 'aspect-square bg-gray-900 relative border border-gray-800 cursor-pointer overflow-hidden';
                        div.innerHTML = `<img data-src="${p.data}" class="w-full h-full object-cover opacity-0 transition-opacity duration-300" loading="lazy" alt="Foto galeri ${p.id}">`;
                        div.onclick = () => this.previewController.open(p);
                        fragment.appendChild(div);
                    });
                    this.dom.galleryGrid.appendChild(fragment);

                    // Setup Intersection Observer untuk lazy loading
                    if (!this.state.galleryObserver) {
                        const imgObserverCallback = (entries, observer) => {
                            entries.forEach(entry => {
                                if (entry.isIntersecting) {
                                    const img = entry.target;
                                    const src = img.dataset.src;
                                    if (src) {
                                        img.src = src;
                                        img.onload = () => {
                                            img.removeAttribute('data-src');
                                            img.classList.remove('opacity-0');
                                        };
                                    }
                                    observer.unobserve(img);
                                }
                            });
                        };

                        this.state.galleryObserver = new IntersectionObserver(imgObserverCallback, {
                            root: this.dom.galleryGrid,
                            rootMargin: '500px'
                        });
                    }

                    this.dom.galleryGrid.querySelectorAll('img[data-src]').forEach(img =>
                        this.state.galleryObserver.observe(img)
                    );
                }
            }
        });
    }
}