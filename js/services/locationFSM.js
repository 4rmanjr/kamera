/**
 * Location Finite State Machine (FSM)
 * Manages the logic for acquiring a stable GPS location.
 */
import { LocationUtils } from '../utils/locationUtils.js';

const FSM_STATES = {
    IDLE: 'IDLE',
    STARTING: 'STARTING',
    ACQUIRING_FAST: 'ACQUIRING_FAST',
    ACQUIRING_STABLE: 'ACQUIRING_STABLE',
    STABILIZING: 'STABILIZING',
    STABLE: 'STABLE',
    ERROR: 'ERROR',
};

export class LocationFSM {
    constructor(config, eventBus) {
        this.config = config;
        this.eventBus = eventBus;
        this.state = FSM_STATES.IDLE;
        this.bestLocation = null;
        this.positionHistory = [];
        this.stabilizationTimer = null;
        this.fastAcquisitionTimer = null;
    }

    transitionTo(newState, data = {}) {
        console.log(`LocationFSM: Transitioning from ${this.state} to ${newState}`);
        this.state = newState;
        this.eventBus.emit('fsm:stateChange', { state: newState, data });

        // Execute state-specific entry actions
        switch (newState) {
            case FSM_STATES.STARTING:
                this.reset();
                this.eventBus.emit('fsm:startAcquisition');
                break;
            case FSM_STATES.ACQUIRING_FAST:
                this.fastAcquisitionTimer = setTimeout(() => {
                    this.transitionTo(FSM_STATES.ACQUIRING_STABLE);
                }, this.config.FAST_ACQUISITION_TIMEOUT_MS);
                break;
            case FSM_STATES.STABILIZING:
                this.stabilizationTimer = setTimeout(() => {
                    this.transitionTo(FSM_STATES.STABLE, { location: this.bestLocation });
                }, this.config.BEST_LOCATION_TIMEOUT_MS);
                break;
            case FSM_STATES.STABLE:
                this.clearTimers();
                this.eventBus.emit('fsm:locationStable', { location: this.bestLocation });
                break;
            case FSM_STATES.ERROR:
                this.clearTimers();
                this.eventBus.emit('fsm:error', data);
                break;
        }
    }

    handleUpdate(position) {
        const currentLocation = this.normalizeLocation(position);
        if (!this.isValidLocation(currentLocation)) return;

        this.updatePositionHistory(currentLocation);

        const isBetter = this.isBetterLocation(currentLocation, this.bestLocation);
        if (isBetter) {
            this.bestLocation = currentLocation;
            this.eventBus.emit('fsm:locationUpdate', { location: this.bestLocation });
        }

        switch (this.state) {
            case FSM_STATES.STARTING:
                this.transitionTo(FSM_STATES.ACQUIRING_FAST);
                // Fall-through to evaluate immediately
            case FSM_STATES.ACQUIRING_FAST:
            case FSM_STATES.ACQUIRING_STABLE:
                if (this.bestLocation.acc <= this.config.MIN_ACCURACY_THRESHOLD) {
                    if (this.isLocationConsistent()) {
                        this.transitionTo(FSM_STATES.STABLE, { location: this.bestLocation });
                    } else if (this.state !== FSM_STATES.STABILIZING) {
                        this.transitionTo(FSM_STATES.STABILIZING);
                    }
                }
                break;
            case FSM_STATES.STABILIZING:
                // If we get a better location while stabilizing, reset the timer
                if (isBetter) {
                    this.transitionTo(FSM_STATES.STABILIZING);
                }
                break;
            case FSM_STATES.STABLE:
                // If a significantly better location is found, re-evaluate
                if (isBetter) {
                    this.transitionTo(FSM_STATES.ACQUIRING_STABLE);
                }
                break;
        }
    }

    // --- Helper Methods (migrated from LocationService) ---

    normalizeLocation(position) {
        return {
            lat: parseFloat(position.coords.latitude),
            lng: parseFloat(position.coords.longitude),
            acc: Math.round(position.coords.accuracy),
            timestamp: position.timestamp,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            speed: position.coords.speed,
            heading: position.coords.heading
        };
    }

    isValidLocation(location) {
        return !isNaN(location.lat) && !isNaN(location.lng) && location.acc > 0 && location.acc <= this.config.MAX_REASONABLE_ACCURACY;
    }

    updatePositionHistory(location) {
        this.positionHistory.push(location);
        if (this.positionHistory.length > this.config.POSITION_HISTORY_SIZE) {
            this.positionHistory.shift();
        }
    }

    isBetterLocation(newLocation, currentBest) {
        if (!currentBest) return true;
        
        const accImprovement = currentBest.acc - newLocation.acc;
        if (accImprovement < 0) return false; // Not more accurate

        // In fast acquisition mode, be more aggressive
        if (this.state === FSM_STATES.ACQUIRING_FAST) {
            return accImprovement > this.config.IMPROVEMENT_THRESHOLD_FOR_FAST_MODE;
        }
        
        // Check for significant improvement
        return accImprovement > this.config.IMPROVEMENT_THRESHOLD_FOR_STABILITY;
    }

    isLocationConsistent() {
        if (this.positionHistory.length < this.config.MIN_CONSISTENT_POSITIONS_FOR_STABILITY) {
            return false;
        }
        const recentPositions = this.positionHistory.slice(-this.config.MIN_CONSISTENT_POSITIONS_FOR_STABILITY);
        const avgLat = recentPositions.reduce((sum, pos) => sum + pos.lat, 0) / recentPositions.length;
        const avgLng = recentPositions.reduce((sum, pos) => sum + pos.lng, 0) / recentPositions.length;

        const consistentCount = recentPositions.filter(pos => {
            const distance = LocationUtils.calculateDistanceFast(avgLat, avgLng, pos.lat, pos.lng);
            return distance < (this.config.MOVEMENT_THRESHOLD_METERS / this.config.KM_PER_DEGREE_APPROX);
        }).length;

        return consistentCount >= this.config.MIN_CONSISTENT_POSITIONS_FOR_STABILITY;
    }

    reset() {
        this.bestLocation = null;
        this.positionHistory = [];
        this.clearTimers();
    }
    
    clearTimers() {
        if (this.stabilizationTimer) clearTimeout(this.stabilizationTimer);
        if (this.fastAcquisitionTimer) clearTimeout(this.fastAcquisitionTimer);
        this.stabilizationTimer = null;
        this.fastAcquisitionTimer = null;
    }
}
