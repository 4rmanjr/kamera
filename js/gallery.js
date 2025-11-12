/**
 * Gallery Controller Module
 * Mengelola fungsionalitas galeri foto dengan virtual scrolling
 */

import { VirtualGallery } from './virtualGallery.js';

export class GalleryController {
    constructor({ state, dom, previewController, eventBus }) {
        this.state = state;
        this.dom = dom;
        this.previewController = previewController;  // Akan di-set nanti setelah instance dibuat
        this.eventBus = eventBus;
        this.virtualGallery = null;
        
        // Subscribe ke event terkait foto
        this.eventBus.subscribe('photo:saved', () => {
            if (!this.dom.modals.gallery.classList.contains('hidden')) {
                this.load();
            }
        });
        
        this.eventBus.subscribe('photo:deleted', () => {
            if (!this.dom.modals.gallery.classList.contains('hidden')) {
                this.load();
            }
        });
        
        this.eventBus.subscribe('gallery:cleared', () => {
            if (!this.dom.modals.gallery.classList.contains('hidden')) {
                this.load();
            }
        });
    }

    setPreviewController(previewController) {
        this.previewController = previewController;
    }

    open() {
        this.dom.modals.gallery.classList.remove('hidden');
        setTimeout(() => this.dom.modals.gallery.classList.remove('translate-y-full'), 10);
        this.load();
    }

    close() {
        if (this.virtualGallery) {
            this.virtualGallery.destroy();
            this.virtualGallery = null;
        }
        this.dom.modals.gallery.classList.add('translate-y-full');
        setTimeout(() => this.dom.modals.gallery.classList.add('hidden'), 300);
    }

    load() {
        // Hapus virtual gallery lama jika ada
        if (this.virtualGallery) {
            this.virtualGallery.destroy();
            this.virtualGallery = null;
        }
        
        // Kita perlu akses ke storage service melalui event
        this.eventBus.emit('gallery:loadRequested', (photos) => {
            document.getElementById('lbl-gallery-count').innerText = `(${photos.length})`;
            if(photos.length === 0) {
                this.dom.galleryGrid.innerHTML = `<div class="col-span-3 flex flex-col items-center mt-20 text-gray-600"><i class="ph ph-images text-4xl mb-2" aria-hidden="true"></i><span class="text-sm">Galeri Kosong</span></div>`;
                return;
            }

            // Gunakan virtual gallery untuk jumlah foto yang banyak
            if (photos.length > 50) { // Threshold untuk menggunakan virtual scrolling
                this.dom.galleryGrid.innerHTML = ''; // Kosongkan dulu
                
                // Setup virtual gallery
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
            } else {
                // Untuk jumlah foto sedikit, gunakan metode tradisional
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
        });
    }
}