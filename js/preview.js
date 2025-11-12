/**
 * Preview Controller Module
 * Mengelola fungsionalitas pratinjau foto
 */

export class PreviewController {
    constructor({ state, dom, storageService, galleryController, eventBus }) {
        this.state = state;
        this.dom = dom;
        this.storageService = storageService;
        this.galleryController = galleryController;
        this.eventBus = eventBus;
    }

    open(photo) {
        this.state.currentPhotoId = photo.id;
        this.state.currentPhotoSrc = photo.data;
        if (this.dom.imgPreview) {
            this.dom.imgPreview.src = photo.data;
        }
        if (this.dom.modals && this.dom.modals.preview) {
            this.dom.modals.preview.classList.remove('hidden');
        }
    }

    close() {
        if (this.dom.modals && this.dom.modals.preview) {
            this.dom.modals.preview.classList.add('hidden');
        }
        if (this.dom.imgPreview) {
            this.dom.imgPreview.src = '';
        }
    }

    download() {
        if (!this.state.currentPhotoSrc) {
            console.error('No photo to download');
            return;
        }
        
        const link = document.createElement('a');
        link.download = `GeoCam_${Date.now()}.jpg`;
        link.href = this.state.currentPhotoSrc;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}