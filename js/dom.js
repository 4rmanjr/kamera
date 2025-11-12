/**
 * DOM Cache Module
 * Menyimpan elemen-elemen DOM untuk meningkatkan kinerja
 */

export const DOM = {
    video: document.getElementById('video-feed'),
    canvas: document.getElementById('canvas-process'),
    flashOverlay: document.getElementById('shutter-flash'),
    lblGeo: document.getElementById('lbl-geo'),
    lblTime: document.getElementById('lbl-time'),
    btnShutter: document.getElementById('btn-shutter'),
    btnSwitch: document.getElementById('btn-switch-cam'),
    btnFlash: document.getElementById('btn-flash'),
    iconFlash: document.getElementById('icon-flash'),
    btnGallery: document.getElementById('btn-gallery'),
    imgThumb: document.getElementById('img-thumb'),
    iconGallery: document.getElementById('icon-gallery'),
    btnSettings: document.getElementById('btn-settings'),
    modals: {
        settings: document.getElementById('modal-settings'),
        gallery: document.getElementById('modal-gallery'),
        preview: document.getElementById('modal-preview'),
        confirm: document.getElementById('modal-confirm')
    },
    inpProject: document.getElementById('inp-project-name'),
    inpNote: document.getElementById('inp-project-note'),
    inpLogo: document.getElementById('inp-logo'),
    previewLogo: document.getElementById('preview-logo'),
    txtNoLogo: document.getElementById('txt-no-logo'),
    galleryGrid: document.getElementById('gallery-grid'),
    imgPreview: document.getElementById('img-preview')
};