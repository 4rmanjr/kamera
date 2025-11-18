/**
 * Dependency Injection Container
 * Mengelola dan menyediakan instance dari semua layanan/modul
 */

import { EventBus, eventBus } from './eventBus.js';
import { DOM, initDOM } from './dom.js';
import { State } from './state.js';
import { StorageService } from '../services/storage.js';
import { CameraService } from '../services/camera.js';
import { LocationService } from '../services/location.js';
import { CanvasProcessorService } from '../services/canvasProcessor.js';
import { GalleryController } from '../components/gallery.js';
import { PreviewController } from '../components/preview.js';
import { UIController } from '../components/ui.js';
import { Utils } from '../utils/utils.js';
import { QRCodeGenerator } from '../models/qrCodeGenerator.js';
import { NotificationService } from '../services/notificationService.js';


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
        // Buat notification service terlebih dahulu
        const notificationService = new NotificationService({
            dom: this.dom,
            eventBus: this.eventBus
        });

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
            eventBus: this.eventBus,
            notificationService
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
            storageService,
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
        this.services.set('notificationService', notificationService);

        return {
            storageService,
            cameraService,
            locationService,
            canvasProcessorService,
            galleryController,
            previewController,
            uiController,
            qrCodeGenerator,
            notificationService
        };
    }
    
    get(serviceName) {
        return this.services.get(serviceName);
    }

    getServices() {
        return Object.fromEntries(this.services);
    }
}

// Membuat instance global container
export const container = new DIContainer();