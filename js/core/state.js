/**
 * State Management Module
 * Mengelola state aplikasi secara terpusat
 */

export const State = {
    db: null,
    stream: null,
    watchId: null,
    facingMode: 'environment',
    hasFlash: false,
    isFlashOn: false,
    location: { lat: 0, lng: 0, acc: 0, altitude: null, altitudeAccuracy: null, speed: null, heading: null },
    settings: {
        projName: localStorage.getItem('gc_projName') || '',
        projNote: localStorage.getItem('gc_projNote') || '',
        textSize: localStorage.getItem('gc_textSize') || 'm',
        textPos: localStorage.getItem('gc_textPos') || 'bl',
        logoPos: localStorage.getItem('gc_logoPos') || 'tr',
        logoSize: localStorage.getItem('gc_logoSize') || 'm', // Add logo size setting
        qrCodeEnabled: localStorage.getItem('gc_qrCodeEnabled') !== 'false', // Default true
        qrCodePos: localStorage.getItem('gc_qrCodePos') || 'br',
        qrCodeSize: localStorage.getItem('gc_qrCodeSize') || 'm'
    },
    customLogoImg: null,
    currentPhotoId: null,
    currentPhotoSrc: null,
    confirmCallback: null,
    galleryObserver: null,
    zoomLevel: 1.0
};