/**
 * Dependency Injection Container
 * Mengelola dan menyediakan instance dari semua layanan/modul
 */

import { EventBus, eventBus } from './eventBus.js';
import { DOM, initDOM } from './dom.js';
import { State } from './state.js';
import { StorageService } from './storage.js';
import { CameraService } from './camera.js';
import { LocationService } from './location.js';
import { CanvasProcessorService } from './canvasProcessor.js';
import { GalleryController } from './gallery.js';
import { PreviewController } from './preview.js';
import { UIController } from './ui.js';
import { Utils } from './utils.js';
import { QRCodeGenerator } from './qrCodeGenerator.js';


export class DIContainer {
    constructor() {
        this.services = new Map();
        this.eventBus = eventBus;
        this.dom = DOM;
        this.state = State;
        this.utils = Utils;
    }

    // Membuat instance dari semua layanan dengan dependency injection yang benar
    initializeServices() {
        // Buat QR code generator
        const qrCodeGenerator = new QRCodeGenerator();

        // Inisialisasi layanan dengan dependencies
        const storageService = new StorageService({ 
            state: this.state, 
            dom: this.dom, 
            eventBus: this.eventBus 
        });
        
        const canvasProcessorService = new CanvasProcessorService({ 
            state: this.state, 
            dom: this.dom, 
            eventBus: this.eventBus,
            qrCodeGenerator
        });
        
        const cameraService = new CameraService({ 
            state: this.state, 
            dom: this.dom, 
            canvasProcessorService,
            eventBus: this.eventBus 
        });
        
        const locationService = new LocationService({ 
            state: this.state, 
            dom: this.dom,
            eventBus: this.eventBus 
        });
        
        const galleryController = new GalleryController({ 
            state: this.state, 
            dom: this.dom, 
            previewController: null, // Akan di-set setelah semua controller dibuat
            eventBus: this.eventBus 
        });
        
        const previewController = new PreviewController({ 
            state: this.state, 
            dom: this.dom, 
            storageService,
            galleryController, // Referensi ke gallery controller
            eventBus: this.eventBus 
        });
        
        const uiController = new UIController({ 
            state: this.state, 
            dom: this.dom, 
            storageService,
            galleryController,
            previewController,
            cameraService,
            locationService,
            utils: this.utils,
            eventBus: this.eventBus 
        });
        
        // Set referensi yang dibutuhkan setelah semua instance dibuat
        galleryController.setPreviewController(previewController);
        
        // Simpan semua instance di container
        this.services.set('storageService', storageService);
        this.services.set('cameraService', cameraService);
        this.services.set('locationService', locationService);
        this.services.set('canvasProcessorService', canvasProcessorService);
        this.services.set('galleryController', galleryController);
        this.services.set('previewController', previewController);
        this.services.set('uiController', uiController);
        this.services.set('qrCodeGenerator', qrCodeGenerator);
        
        return {
            storageService,
            cameraService,
            locationService,
            canvasProcessorService,
            galleryController,
            previewController,
            uiController,
            qrCodeGenerator
        };
    }
    
    get(serviceName) {
        return this.services.get(serviceName);
    }
}

// Membuat instance global container
export const container = new DIContainer();