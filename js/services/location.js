/**
 * Location Service Module
 * Manages geolocation functionality by delegating complex logic to a Finite State Machine (FSM).
 */

import { LocationFSM } from './locationFSM.js';
import { LocationConfig } from '../utils/locationConfig.js';

export class LocationService {
    constructor({ state, dom, eventBus }) {
        this.state = state;
        this.dom = dom;
        this.eventBus = eventBus;
        this.config = LocationConfig.DEFAULT_CONFIG;

        // The FSM now manages all the complex state logic.
        this.fsm = new LocationFSM(this.config, this.eventBus);

        this.subscribeToFSMEvents();
    }

    subscribeToFSMEvents() {
        this.eventBus.subscribe('fsm:stateChange', ({ state, data }) => {
            this.updateLocationDisplay(state, data?.location);
        });

        this.eventBus.subscribe('fsm:locationUpdate', ({ location }) => {
            if (this.fsm.state !== 'STABLE') {
                this.updateLocationDisplay(this.fsm.state, location);
            }
        });
        
        this.eventBus.subscribe('fsm:locationStable', ({ location }) => {
            this.state.location = this.normalizeForState(location);
            this.eventBus.emit('location:updated', this.state.location);
        });

        this.eventBus.subscribe('fsm:error', ({ error }) => {
            this.handleLocationError(error);
        });
        
        this.eventBus.subscribe('fsm:startAcquisition', () => {
            this.startGeolocationWatch();
        });
    }

    init() {
        if ("geolocation" in navigator) {
            this.fsm.transitionTo('STARTING');
        } else {
            this.handleLocationError({ code: -1, message: "GPS Tidak Didukung" });
        }
    }
    
    startGeolocationWatch() {
        if (this.state.watchId) {
            navigator.geolocation.clearWatch(this.state.watchId);
        }
        this.state.watchId = navigator.geolocation.watchPosition(
            (position) => this.fsm.handleUpdate(position),
            (error) => this.fsm.transitionTo('ERROR', { error }),
            {
                enableHighAccuracy: true,
                timeout: this.config.DEFAULT_TIMEOUT_MS,
                maximumAge: 0,
            }
        );
    }

    handleLocationError(err) {
        let errorMessage = "GPS Error";
        if (err.code !== -1) { // -1 is our custom code for 'not supported'
            switch(err.code) {
                case err.PERMISSION_DENIED: errorMessage = "Izin lokasi ditolak"; break;
                case err.POSITION_UNAVAILABLE: errorMessage = "Data lokasi tidak tersedia"; break;
                case err.TIMEOUT: errorMessage = "Waktu permintaan lokasi habis"; break;
            }
        } else {
            errorMessage = err.message;
        }

        if (this.dom.lblGeo) {
            this.dom.lblGeo.innerHTML = `<i class="ph ph-warning text-red-400" aria-hidden="true"></i> ${errorMessage}`;
            this.dom.lblGeo.onclick = () => this.init();
        }
    }

    updateLocationDisplay(state, location) {
        if (!this.dom.lblGeo) return;

        let html = '';
        switch(state) {
            case 'STARTING':
                html = `<i class="ph ph-spinner animate-spin mr-1" aria-hidden="true"></i> Memulai GPS...`;
                break;
            case 'ACQUIRING_FAST':
            case 'ACQUIRING_STABLE':
                const acc = location ? `±${location.acc}m` : '...';
                html = `<i class="ph ph-spinner animate-spin text-blue-400" aria-hidden="true"></i> Mencari sinyal stabil (${acc})`;
                break;
            case 'STABILIZING':
                html = `<i class="ph ph-timer text-yellow-400" aria-hidden="true"></i> Memvalidasi lokasi (±${location.acc}m)`;
                break;
            case 'STABLE':
                const lat = location.lat.toFixed(this.config.DEFAULT_COORDINATE_PRECISION);
                const lng = location.lng.toFixed(this.config.DEFAULT_COORDINATE_PRECISION);
                html = `<i class="ph ph-map-pin text-green-400" aria-hidden="true"></i> ${lat}, ${lng} (±${location.acc}m)`;
                break;
            case 'ERROR':
                // Error display is handled by handleLocationError
                return;
            default:
                html = `<i class="ph ph-question" aria-hidden="true"></i> Status tidak diketahui`;
        }
        this.dom.lblGeo.innerHTML = html;
    }

    normalizeForState(location) {
        return {
            lat: location.lat.toFixed(this.config.DEFAULT_COORDINATE_PRECISION),
            lng: location.lng.toFixed(this.config.DEFAULT_COORDINATE_PRECISION),
            acc: location.acc,
            altitude: location.altitude,
            altitudeAccuracy: location.altitudeAccuracy,
            speed: location.speed,
            heading: location.heading,
        };
    }

    pause() {
        if (this.state.watchId) {
            navigator.geolocation.clearWatch(this.state.watchId);
            this.state.watchId = null;
            this.fsm.transitionTo('IDLE');
        }
    }

    resume() {
        if (!this.state.watchId) {
            this.init();
        }
    }

    destroy() {
        this.pause();
    }
}