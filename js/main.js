/**
 * Main Application Entry Point
 * Menginisialisasi dan menggabungkan semua modul melalui dependency injection
 */

import { DIContainer, container } from './core/container.js';
import { initDOM } from './core/dom.js';

// ================= BOOTSTRAP =================
window.onload = async () => {
    try {
        // First initialize DOM elements
        initDOM();
        
        // Inisialisasi container dan layanan
        const services = container.initializeServices();

        // Inisialisasi modul dalam urutan yang benar
        services.uiController.initPWA(); // (BARU v6.4) Langsung inisialisasi PWA "Lite"

        await services.storageService.init(); // Tunggu DB siap
        services.uiController.initListeners();
        services.uiController.loadSettings();
        services.uiController.startClock();
        // Initialize back button handler after listeners are set up
        services.uiController.initBackButtonHandler();
        await services.cameraService.start(); // Tunggu kamera siap
        services.locationService.init();
    } catch (err) {
        console.error("Gagal inisialisasi aplikasi:", err);
        // Using direct DOM access since services may not be fully initialized if there's an error
        const lblGeo = document.getElementById('lbl-geo');
        if(lblGeo) {
            lblGeo.innerHTML = `<i class="ph ph-warning text-red-400" aria-hidden="true"></i> Gagal Muat Aplikasi`;
        }
    }
};

// Cleanup resources when page is unloaded
window.addEventListener('beforeunload', () => {
    try {
        const services = container.getServices();
        if (services.canvasProcessorService && typeof services.canvasProcessorService.destroy === 'function') {
            services.canvasProcessorService.destroy();
        }
        if (services.cameraService && typeof services.cameraService.destroy === 'function') {
            services.cameraService.destroy();
        }
        if (services.locationService && typeof services.locationService.destroy === 'function') {
            services.locationService.destroy();
        }
    } catch (err) {
        console.error("Gagal membersihkan sumber daya:", err);
    }
});

// Handle app visibility changes for better resource management
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // Pause non-critical operations when app is not visible
        const services = container.getServices();
        if (services.locationService && typeof services.locationService.pause === 'function') {
            services.locationService.pause();
        }
        // Pause camera when app is not visible to save resources
        if (services.cameraService && typeof services.cameraService.pause === 'function') {
            services.cameraService.pause();
        }
    } else if (document.visibilityState === 'visible') {
        // Resume operations when app becomes visible
        const services = container.getServices();
        if (services.locationService && typeof services.locationService.resume === 'function') {
            services.locationService.resume();
        }
        // Restart camera when app becomes visible
        if (services.cameraService && typeof services.cameraService.start === 'function') {
            services.cameraService.start();
        }
    }
});