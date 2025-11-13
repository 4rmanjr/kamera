/**
 * Main Application Entry Point
 * Menginisialisasi dan menggabungkan semua modul melalui dependency injection
 */

import { DIContainer, container } from './container.js';
import { initDOM } from './dom.js';

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