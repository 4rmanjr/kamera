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
        this.currentPhotos = [];  // Cache untuk menyimpan daftar foto saat ini
        this.currentIndex = -1;  // Index foto saat ini dalam daftar
    }

    // Fungsi utilitas untuk menghasilkan timestamp yang konsisten
    generateTimestamp() {
        return new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').substring(0, 15);
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

        // Emit event to notify UI controller that preview is opened
        this.eventBus.emit('preview:opened');
    }

    openWithPhotos(photo, photos) {
        // Simpan daftar foto
        this.currentPhotos = photos;
        // Temukan indeks foto saat ini
        this.currentIndex = photos.findIndex(p => p.id === photo.id);
        
        // Jika foto tidak ditemukan dalam daftar, atur ke indeks pertama jika ada foto
        if (this.currentIndex === -1 && photos.length > 0) {
            this.currentIndex = 0;
        }

        // Buka pratinjau foto
        this.open(photo);
    }

    next() {
        if (this.currentPhotos.length === 0 || this.currentIndex === -1) {
            // Tidak bisa navigasi jika tidak ada foto atau indeks tidak valid
            return null;
        }

        const nextIndex = (this.currentIndex + 1) % this.currentPhotos.length;
        this.currentIndex = nextIndex;
        const nextPhoto = this.currentPhotos[nextIndex];

        this.open(nextPhoto);
        return nextPhoto;
    }

    prev() {
        if (this.currentPhotos.length === 0 || this.currentIndex === -1) {
            // Tidak bisa navigasi jika tidak ada foto atau indeks tidak valid
            return null;
        }

        const prevIndex = (this.currentIndex - 1 + this.currentPhotos.length) % this.currentPhotos.length;
        this.currentIndex = prevIndex;
        const prevPhoto = this.currentPhotos[prevIndex];

        this.open(prevPhoto);
        return prevPhoto;
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

        // Create filename with timestamp and method
        const timestamp = this.generateTimestamp();
        const fileName = `GeoCam_${timestamp}_download.${extension}`;

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
                const timestamp = this.generateTimestamp();
                const fileName = `GeoCam_${timestamp}_share.${extension}`;

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
                    console.log('File sharing not supported by Web Share API');
                    // Show notification that sharing is not supported
                    this.eventBus.emit('notification:show', {
                        message: 'Platform ini tidak mendukung pembagian file. Silakan gunakan tombol unduh.',
                        type: 'info'
                    });
                }
            } else {
                console.log('Web Share API not supported');
                // Show notification that sharing is not supported
                this.eventBus.emit('notification:show', {
                    message: 'Platform ini tidak mendukung fitur berbagi. Silakan gunakan tombol unduh.',
                    type: 'info'
                });
            }
        } catch (error) {
            console.error('Error sharing photo:', error);
            // Show notification about the error
            this.eventBus.emit('notification:show', {
                message: 'Gagal membagikan foto. Silakan gunakan tombol unduh.',
                type: 'error'
            });
        }
    }
}