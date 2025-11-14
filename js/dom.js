/**
 * DOM Cache Module
 * Menyimpan elemen-elemen DOM untuk meningkatkan kinerja
 */

export const DOM = {
    video: null,
    canvas: null,
    flashOverlay: null,
    lblGeo: null,
    lblTime: null,
    btnShutter: null,
    btnSwitch: null,
    btnFlash: null,
    iconFlash: null,
    btnGallery: null,
    imgThumb: null,
    iconGallery: null,
    btnSettings: null,
    modals: {
        settings: null,
        gallery: null,
        preview: null,
        confirm: null
    },
    inpProject: null,
    inpNote: null,
    inpLogo: null,
    previewLogo: null,
    txtNoLogo: null,
    galleryGrid: null,
    imgPreview: null,
    lblCameraStatus: null
};

// Function to initialize DOM elements after the page has loaded
export function initDOM() {
    DOM.video = document.getElementById('video-feed');
    DOM.canvas = document.getElementById('canvas-process');
    DOM.flashOverlay = document.getElementById('shutter-flash');
    DOM.lblGeo = document.getElementById('lbl-geo');
    DOM.lblTime = document.getElementById('lbl-time');
    DOM.btnShutter = document.getElementById('btn-shutter');
    DOM.btnSwitch = document.getElementById('btn-switch-cam');
    DOM.btnFlash = document.getElementById('btn-flash');
    DOM.iconFlash = document.getElementById('icon-flash');
    DOM.btnGallery = document.getElementById('btn-gallery');
    DOM.imgThumb = document.getElementById('img-thumb');
    DOM.iconGallery = document.getElementById('icon-gallery');
    DOM.btnSettings = document.getElementById('btn-settings');
    DOM.modals.settings = document.getElementById('modal-settings');
    DOM.modals.gallery = document.getElementById('modal-gallery');
    DOM.modals.preview = document.getElementById('modal-preview');
    DOM.modals.confirm = document.getElementById('modal-confirm');
    DOM.inpProject = document.getElementById('inp-project-name');
    DOM.inpNote = document.getElementById('inp-project-note');
    DOM.inpLogo = document.getElementById('inp-logo');
    DOM.previewLogo = document.getElementById('preview-logo');
    DOM.txtNoLogo = document.getElementById('txt-no-logo');
    DOM.galleryGrid = document.getElementById('gallery-grid');
    DOM.imgPreview = document.getElementById('img-preview');
    DOM.lblCameraStatus = document.getElementById('lbl-camera-status');
}