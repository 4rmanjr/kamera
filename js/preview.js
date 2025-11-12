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
        
        // Determine the correct file type from the data URL
        const mimeType = this.state.currentPhotoSrc.split(',')[0].split(':')[1].split(';')[0];
        
        // Extract extension from MIME type
        let extension = 'jpg'; // default
        if (mimeType === 'image/png') extension = 'png';
        else if (mimeType === 'image/gif') extension = 'gif';
        else if (mimeType === 'image/webp') extension = 'webp';
        else if (mimeType === 'image/jpeg') extension = 'jpg';

        // Create filename with proper extension
        const fileName = this.state.currentPhotoId ? 
            `GeoCam_${this.state.currentPhotoId}.${extension}` : 
            `GeoCam_${Date.now()}.${extension}`;
        
        link.download = fileName;
        link.href = this.state.currentPhotoSrc;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async share() {
        if (!this.state.currentPhotoSrc) {
            console.error('No photo to share');
            return;
        }

        try {
            // Check if Web Share API is available
            if (navigator.share) {
                // Convert data URL to blob for sharing
                const response = await fetch(this.state.currentPhotoSrc);
                const blob = await response.blob();
                
                // Determine the correct file type from the data URL
                const mimeType = this.state.currentPhotoSrc.split(',')[0].split(':')[1].split(';')[0];
                
                // Extract extension from MIME type
                let extension = 'jpg'; // default
                if (mimeType === 'image/png') extension = 'png';
                else if (mimeType === 'image/gif') extension = 'gif';
                else if (mimeType === 'image/webp') extension = 'webp';
                else if (mimeType === 'image/jpeg') extension = 'jpg';

                // Create file object with correct type and extension
                const fileName = this.state.currentPhotoId ? 
                    `GeoCam_${this.state.currentPhotoId}.${extension}` : 
                    `GeoCam_${Date.now()}.${extension}`;
                    
                const file = new File([blob], fileName, { type: mimeType });
                
                // Check if the file can be shared
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    // Share the file
                    await navigator.share({
                        title: 'Foto dari Geo Camera Pro',
                        text: 'Berikut adalah foto yang saya ambil dengan Geo Camera Pro',
                        files: [file]
                    });
                } else {
                    // Fallback to download if file sharing is not supported
                    console.log('File sharing not supported by Web Share API, triggering download instead');
                    this.download();
                }
            } else {
                // Fallback: trigger download if Web Share API is not supported
                this.download();
                console.log('Web Share API not supported, triggering download instead');
            }
        } catch (error) {
            console.error('Error sharing photo:', error);
            // If sharing fails, fallback to download
            this.download();
        }
    }
}