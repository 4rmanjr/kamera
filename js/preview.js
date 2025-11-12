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
        this.dom.imgPreview.src = photo.data; 
        this.dom.modals.preview.classList.remove('hidden');
    }

    close() {
        this.dom.modals.preview.classList.add('hidden'); 
        this.dom.imgPreview.src = '';
    }

    download() {
        const link = document.createElement('a'); 
        link.download = `GeoCam_${Date.now()}.jpg`;
        link.href = this.state.currentPhotoSrc; 
        document.body.appendChild(link);
        link.click(); 
        document.body.removeChild(link);
    }
}