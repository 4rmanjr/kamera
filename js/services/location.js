/**
 * Location Service Module (Enhanced Real-Time Performance & Accuracy)
 * Mengelola fungsionalitas geolokasi dengan akurasi dan performa real-time yang lebih baik
 */

import { LocationUtils } from '../utils/locationUtils.js';
import { LocationConfig } from '../utils/locationConfig.js';

export class LocationService {
    constructor({ state, dom, eventBus, config = null }) {
        this.state = state;
        this.dom = dom;
        this.eventBus = eventBus;

        // Gunakan konfigurasi default atau konfigurasi yang disediakan
        this.config = config || LocationConfig.DEFAULT_CONFIG;

        // Konfigurasi performa real-time
        this.MIN_ACCURACY = this.config.MIN_ACCURACY_THRESHOLD; // Akurasi target dalam meter
        this.BEST_LOCATION_TIMEOUT = this.config.BEST_LOCATION_TIMEOUT_MS; // dalam milidetik
        this.MOVEMENT_THRESHOLD = this.config.MOVEMENT_THRESHOLD_METERS; // Meter - ambang perubahan posisi yang signifikan
        // Deteksi apakah perangkat rendah untuk mengatur parameter geolocation
        const isLowEndDevice = this.isLowEndDevice();

        // Optimalkan update debounce dan history size untuk perangkat rendah
        this.UPDATE_DEBOUNCE = isLowEndDevice ? this.config.UPDATE_DEBOUNCE_MS * 2 : this.config.UPDATE_DEBOUNCE_MS; // Milidetik - lebih cepat untuk update UI real-time
        this.POSITION_HISTORY_SIZE = isLowEndDevice ? Math.floor(this.config.POSITION_HISTORY_SIZE / 2) : this.config.POSITION_HISTORY_SIZE; // Ukuran riwayat posisi
        this.FAST_ACQUISITION_TIMEOUT = isLowEndDevice ? this.config.FAST_ACQUISITION_TIMEOUT_MS * 1.5 : this.config.FAST_ACQUISITION_TIMEOUT_MS; // Waktu awal untuk akuisisi cepat

        // Status internal
        this.bestLocation = null;
        this.isLocationStable = false;
        this.locationTimer = null;
        this.updateDebounceTimer = null;
        this.positionHistory = [];
        this.lastUpdateTime = 0;
        this.fastAcquisitionActive = true; // Mode akuisisi cepat aktif awalnya
        this.initialAcquisitionStartTime = 0;

        // Cache untuk hasil konsistensi lokasi terakhir
        this.lastConsistencyCheck = {
            positionHash: null,
            result: false,
            timestamp: 0
        };
        this.consistencyDebounceTime = this.config.CONSISTENCY_CHECK_DEBOUNCE_MS; // dalam milidetik, mencegah perhitungan berlebihan

        // Subscribe to location refresh requests
        this.eventBus.subscribe('location:requestRefresh', () => {
            this.handleLocationRefreshRequest();
        });
    }

    // Fungsi untuk mendeteksi apakah perangkat memiliki spesifikasi rendah
    isLowEndDevice() {
        // Mendeteksi perangkat berdasarkan RAM dan core CPU
        const navigatorConnection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4; // Kurang dari 4GB RAM
        const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4; // Kurang dari 4 core
        const slowConnection = navigatorConnection && (navigatorConnection.effectiveType === 'slow-2g' || navigatorConnection.effectiveType === '2g');

        // Kombinasi faktor untuk menentukan perangkat rendah
        return lowMemory || lowCores || slowConnection;
    }

    init() {
        if ("geolocation" in navigator) {
            // Hentikan watch position yang sebelumnya jika ada
            if (this.state.watchId) {
                navigator.geolocation.clearWatch(this.state.watchId);
            }
            
            // Reset status lokasi
            this.resetLocationStatus();
            this.initialAcquisitionStartTime = Date.now();

            // Tampilkan status awal
            if (this.dom.lblGeo) {
                this.dom.lblGeo.innerHTML = `<i class="ph ph-spinner animate-spin mr-1" aria-hidden="true"></i> Mengoptimalkan GPS...`;
            }

            this.state.watchId = navigator.geolocation.watchPosition(
                (p) => {
                    this.processLocationUpdate(p);
                },
                (err) => {
                    this.handleLocationError(err);
                },
                {
                    enableHighAccuracy: true,
                    timeout: this.config.DEFAULT_TIMEOUT_MS, // Lebih pendek dari sebelumnya untuk respons lebih cepat
                    maximumAge: 0,
                    distanceFilter: this.config.DISTANCE_FILTER_METERS // Lebih kecil dari sebelumnya untuk deteksi perubahan halus
                }
            );
        } else {
            if (this.dom.lblGeo) {
                this.dom.lblGeo.innerText = "GPS Tidak Didukung";
            }
        }
    }

    resetLocationStatus() {
        this.isLocationStable = false;
        this.bestLocation = null;
        this.positionHistory = [];
        this.fastAcquisitionActive = true;

        if (this.locationTimer) {
            clearTimeout(this.locationTimer);
            this.locationTimer = null;
        }

        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
            this.updateDebounceTimer = null;
        }
    }

    handleLocationError(err) {
        let errorMessage = "GPS Error";
        switch(err.code) {
            case err.PERMISSION_DENIED:
                errorMessage = "Izin lokasi ditolak";
                break;
            case err.POSITION_UNAVAILABLE:
                errorMessage = "Data lokasi tidak tersedia";
                break;
            case err.TIMEOUT:
                errorMessage = "Waktu permintaan lokasi habis";
                break;
        }

        if (this.dom.lblGeo) {
            this.dom.lblGeo.innerHTML = `<i class="ph ph-warning text-red-400" aria-hidden="true"></i> ${errorMessage} (Tap untuk Ulang)`;
            
            // Clear any existing onclick handler to prevent memory leaks
            this.dom.lblGeo.onclick = null;
            
            // Assign the new onclick handler
            this.dom.lblGeo.onclick = () => {
                this.dom.lblGeo.innerHTML = `<i class="ph ph-spinner animate-spin mr-1" aria-hidden="true"></i> Mencari GPS...`;
                this.init();
            };
        }
    }

    processLocationUpdate(position) {
        // Validasi posisi sebelum diproses
        if (!this.isValidPosition(position)) {
            return;
        }

        // Normalisasi data lokasi
        const currentLocation = this.normalizeLocation(position);

        // Validasi lokasi sebelum diproses lebih lanjut
        if (!this.isValidLocation(currentLocation)) {
            return;
        }

        // Tambahkan ke riwayat
        this.updatePositionHistory(currentLocation);

        // Evaluasi apakah lokasi ini lebih baik dari sebelumnya
        const isNewBestLocation = this.evaluateNewBestLocation(currentLocation);

        // Jadwalkan update UI jika diperlukan
        this.scheduleLocationDisplayUpdate(isNewBestLocation);

        // Evaluasi stabilitas lokasi
        this.evaluateLocationStability();
    }

    /**
     * Validasi posisi dari geolocation API
     * @param {GeolocationPosition} position - Posisi dari geolocation API
     * @returns {boolean} Apakah posisi valid
     */
    isValidPosition(position) {
        return position && position.coords;
    }

    /**
     * Validasi apakah lokasi sesuai kriteria untuk diproses
     * @param {Object} location - Lokasi untuk divalidasi
     * @returns {boolean} Apakah lokasi valid
     */
    isValidLocation(location) {
        // Validasi bahwa nilai-nilai penting valid
        if (isNaN(location.lat) || isNaN(location.lng)) {
            return false;
        }

        // Hanya proses jika akurasi masuk akal
        return location.acc <= this.config.MAX_REASONABLE_ACCURACY && location.acc > 0;
    }

    /**
     * Normalisasi data dari geolocation API ke format internal
     * @param {GeolocationPosition} position - Posisi dari geolocation API
     * @returns {Object} Lokasi yang dinormalisasi
     */
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

    /**
     * Update riwayat posisi dengan data baru
     * @param {Object} location - Lokasi baru untuk ditambahkan
     */
    updatePositionHistory(location) {
        this.positionHistory.push(location);
        if (this.positionHistory.length > this.config.POSITION_HISTORY_SIZE) {
            this.positionHistory.shift(); // Hapus item tertua
        }
    }

    /**
     * Evaluasi apakah lokasi baru lebih baik dari lokasi terbaik sebelumnya
     * @param {Object} currentLocation - Lokasi baru
     * @returns {boolean} Apakah ini lokasi terbaik baru
     */
    evaluateNewBestLocation(currentLocation) {
        const isNewBestLocation = !this.bestLocation || this.isBetterLocation(currentLocation, this.bestLocation);
        if (isNewBestLocation) {
            this.bestLocation = currentLocation;
        }
        return isNewBestLocation;
    }

    /**
     * Jadwalkan update tampilan lokasi jika diperlukan
     * @param {boolean} isNewBestLocation - Apakah ini lokasi terbaik baru
     */
    scheduleLocationDisplayUpdate(isNewBestLocation) {
        // Update tampilan UI hanya jika ini adalah best location baru dan kita dalam mode tidak stabil
        if (isNewBestLocation || !this.isLocationStable) {
            const now = Date.now();
            if (now - this.lastUpdateTime > this.config.UPDATE_DEBOUNCE_MS) {
                this.updateLocationDisplay(this.bestLocation);
                this.lastUpdateTime = now;
            } else {
                // Gunakan timer untuk update nanti jika belum waktunya
                // Hanya clear timer jika benar-benar ada
                if (this.updateDebounceTimer !== null && this.updateDebounceTimer !== undefined) {
                    clearTimeout(this.updateDebounceTimer);
                }

                // Bind context sehingga 'this' tetap merujuk ke instance class di dalam fungsi setTimeout
                this.updateDebounceTimer = setTimeout(() => {
                    this.updateLocationDisplay(this.bestLocation);
                    this.lastUpdateTime = Date.now();
                }, this.config.UPDATE_DEBOUNCE_MS);
            }
        }
    }

    /**
     * Evaluasi stabilitas lokasi dan tentukan tindakan yang perlu diambil
     */
    evaluateLocationStability() {
        // Cek apakah lokasi sudah cukup stabil atau akurat
        if (!this.isLocationStable && this.bestLocation) {
            // Aktifkan mode akuisisi cepat untuk 3 detik pertama
            if (this.fastAcquisitionActive && (Date.now() - this.initialAcquisitionStartTime) > this.config.FAST_ACQUISITION_TIMEOUT_MS) {
                this.fastAcquisitionActive = false;
            }

            // Cek apakah kita sudah mendapatkan lokasi yang cukup akurat
            if (this.bestLocation.acc <= this.config.MIN_ACCURACY_THRESHOLD) {
                // Dalam mode akuisisi cepat, pertimbangkan untuk menstabilkan lebih awal
                if (this.fastAcquisitionActive || this.isLocationConsistent()) {
                    this.makeLocationStable();
                } else {
                    // Reset timer jika lokasi akurat baru ditemukan agar kita selalu menggunakan data terbaru
                    if (this.locationTimer !== null && this.locationTimer !== undefined) {
                        clearTimeout(this.locationTimer);
                    }
                    this.locationTimer = setTimeout(() => {
                        this.makeLocationStable();
                    }, this.config.BEST_LOCATION_TIMEOUT_MS);
                }
            } else {
                // Jika belum akurat, tetap atur timer sebagai fallback jika belum ada
                if (this.locationTimer === null || this.locationTimer === undefined) {
                    this.locationTimer = setTimeout(() => {
                        this.makeLocationStable();
                    }, this.config.BEST_LOCATION_TIMEOUT_MS);
                }
            }
        }
    }

    // Fungsi untuk menentukan apakah lokasi baru lebih baik dari yang sekarang
    isBetterLocation(newLocation, currentBest) {
        // Validasi awal yang cepat
        if (!newLocation || !currentBest) {
            return !currentBest; // Jika currentBest null, maka newLocation lebih baik
        }

        // Ambil nilai akurasi untuk penggunaan berulang
        const newAcc = newLocation.acc;
        const currentAcc = currentBest.acc;

        // Validasi akurasi - harus berupa angka positif
        if (!newAcc || !currentAcc || 
            typeof newAcc !== 'number' || typeof currentAcc !== 'number' ||
            newAcc <= 0 || currentAcc <= 0) {
            return false; // Jika salah satu tidak memiliki akurasi valid positif, jangan ganti
        }

        // Periksa apakah akurasi baru lebih baik sebelum melakukan perhitungan kompleks
        if (newAcc >= currentAcc) {
            return false; // Jika akurasi baru tidak lebih baik, langsung kembalikan false
        }

        // Dalam mode akuisisi cepat, lebih responsif terhadap perbaikan akurasi
        const accuracyImprovement = currentAcc - newAcc;

        // Calculate accuracy ratio dengan perlindungan terhadap pembagian dengan nol
        const accuracyRatio = newAcc > 0 ? currentAcc / newAcc : 0;

        if (this.fastAcquisitionActive) {
            // Dalam mode cepat, lebih mudah menerima perbaikan
            return accuracyImprovement > this.config.IMPROVEMENT_THRESHOLD_FOR_FAST_MODE || accuracyRatio > this.config.ACCURACY_RATIO_THRESHOLD_FOR_FAST_MODE;
        }

        // Lokasi baru lebih baik jika:
        // 1. Akurasinya jauh lebih baik (lebih kecil)
        // 2. Akurasinya lebih baik dan tidak jauh lebih lama
        if (accuracyImprovement > this.config.IMPROVEMENT_THRESHOLD_FOR_STABILITY || accuracyRatio > this.config.CONVERGENCE_FACTOR) {
            return true;
        }

        // Jika akurasinya serupa, pilih yang punya akurasi lebih baik
        if (Math.abs(accuracyImprovement) < this.config.SIMILAR_ACCURACY_THRESHOLD) {
            return true; // Karena kita sudah tahu newAcc < currentAcc dari awal
        }

        return false;
    }

    // Cek konsistensi lokasi berdasarkan riwayat
    isLocationConsistent() {
        if (!this.positionHistory || this.positionHistory.length < this.config.MIN_CONSISTENT_POSITIONS_FOR_STABILITY) {
            return false; // Perlu cukup data untuk menilai konsistensi
        }

        // Cek apakah kita bisa menggunakan cache untuk menghindari perhitungan berulang
        const now = Date.now();
        const recentPositions = this.positionHistory.slice(-this.config.MIN_CONSISTENT_POSITIONS_FOR_STABILITY);
        
        // Buat hash dari posisi terbaru untuk menentukan apakah perlu menghitung ulang
        // Gunakan presisi lebih tinggi untuk deteksi perubahan kecil
        const positionHash = recentPositions.map(pos =>
            `${pos.lat.toFixed(this.config.COORDINATE_PRECISION_FOR_HASH)},${pos.lng.toFixed(this.config.COORDINATE_PRECISION_FOR_HASH)},${pos.acc}`
        ).join('|');
        
        // Gunakan cache jika hasilnya masih fresh (kurang dari consistencyDebounceTime ms)
        if (this.lastConsistencyCheck.positionHash === positionHash && 
            (now - this.lastConsistencyCheck.timestamp) < this.consistencyDebounceTime) {
            return this.lastConsistencyCheck.result;
        }

        // Hitung rata-rata posisi dari beberapa pembacaan terakhir
        const avgLat = recentPositions.reduce((sum, pos) => sum + pos.lat, 0) / recentPositions.length;
        const avgLng = recentPositions.reduce((sum, pos) => sum + pos.lng, 0) / recentPositions.length;

        // Hitung seberapa dekat pembacaan terbaru dengan rata-rata
        let consistentCount = 0;
        const distanceThreshold = this.MOVEMENT_THRESHOLD / this.config.KM_PER_DEGREE_APPROX; // Dalam derajat

        // Gunakan aproach yang lebih efisien untuk menghitung jarak dalam skala kecil
        // Lakukan early exit jika sudah ditemukan cukup banyak posisi yang tidak konsisten
        const requiredConsistent = this.config.MIN_CONSISTENT_POSITIONS_FOR_STABILITY; // Jumlah minimum yang diperlukan untuk konsistensi
        const maxInconsistent = recentPositions.length - requiredConsistent; // Jumlah maksimum yang bisa tidak konsisten
        let inconsistentCount = 0;

        for (const pos of recentPositions) {
            const distance = LocationUtils.calculateDistanceFast(avgLat, avgLng, pos.lat, pos.lng);
            if (distance < distanceThreshold) {
                consistentCount++;
                // Jika sudah mencapai jumlah yang dibutuhkan, hentikan perhitungan
                if (consistentCount >= requiredConsistent) {
                    break;
                }
            } else {
                inconsistentCount++;
                // Jika sudah terlalu banyak yang tidak konsisten, hentikan perhitungan
                if (inconsistentCount > maxInconsistent) {
                    break;
                }
            }
        }

        // Simpan hasil ke cache
        this.lastConsistencyCheck = {
            positionHash,
            result: consistentCount >= this.config.MIN_CONSISTENT_POSITIONS_FOR_STABILITY,
            timestamp: now
        };

        // Jika sebagian besar pembacaan konsisten, anggap lokasi stabil
        return this.lastConsistencyCheck.result;
    }


    makeLocationStable() {
        if (!this.isLocationStable && this.bestLocation) {
            this.isLocationStable = true;

            // Hentikan timer jika masih berjalan
            if (this.locationTimer) {
                clearTimeout(this.locationTimer);
                this.locationTimer = null;
            }

            // Hitung lokasi rata-rata dari beberapa pembacaan terbaik untuk presisi tambahan
            const refinedLocation = this.calculateRefinedLocation();

            // Pastikan refinedLocation valid sebelum digunakan
            if (!refinedLocation) {
                console.error("refinedLocation tidak valid di makeLocationStable");
                return;
            }

            // Tampilkan bahwa lokasi telah stabil
            if (this.dom.lblGeo) {
                this.dom.lblGeo.innerHTML = `<i class="ph ph-map-pin text-green-400" aria-hidden="true"></i> ${refinedLocation.lat.toFixed(this.config.DEFAULT_COORDINATE_PRECISION)}, ${refinedLocation.lng.toFixed(this.config.DEFAULT_COORDINATE_PRECISION)} (±${refinedLocation.acc}m)`;
            }

            // Simpan lokasi stabil ke state
            this.state.location = {
                lat: refinedLocation.lat.toFixed(this.config.DEFAULT_COORDINATE_PRECISION),
                lng: refinedLocation.lng.toFixed(this.config.DEFAULT_COORDINATE_PRECISION),
                acc: refinedLocation.acc,
                altitude: refinedLocation.altitude,
                altitudeAccuracy: refinedLocation.altitudeAccuracy,
                speed: refinedLocation.speed,
                heading: refinedLocation.heading
            };

            // Emit event bahwa lokasi telah diperbarui
            this.eventBus.emit('location:updated', this.state.location);
        }
    }

    calculateRefinedLocation() {
        if (!this.positionHistory || this.positionHistory.length === 0) {
            return this.bestLocation; // Kembalikan bestLocation jika tidak ada riwayat
        }

        // Ambil beberapa pembacaan terbaik berdasarkan akurasi
        const bestPositions = this.getBestPositionsByAccuracy();

        // Validasi bahwa kita punya posisi valid untuk diproses
        if (bestPositions.length === 0) {
            return this.getDefaultLocationFallback();
        }

        // Hitung rata-rata tertimbang berdasarkan akurasi
        const weightedResult = this.calculateWeightedAverage(bestPositions);

        if (weightedResult) {
            // Validasi hasil akhir untuk memastikan semuanya valid
            if (this.isValidCalculatedLocation(weightedResult)) {
                return weightedResult;
            } else {
                return this.getInvalidCalculationFallback(bestPositions);
            }
        } else {
            // Jika weightSum adalah 0 karena semua posisi memiliki akurasi tak valid
            return this.getFallbackByBestAccuracy() || this.getDefaultLocationFallback();
        }
    }

    /**
     * Ambil posisi terbaik berdasarkan akurasi
     * @returns {Array} Array posisi terbaik
     */
    getBestPositionsByAccuracy() {
        const maxPositions = Math.min(7, this.positionHistory.length);
        return this.positionHistory
            .slice() // Buat salinan array agar tidak mengubah aslinya
            .sort((a, b) => a.acc - b.acc)  // Urutkan berdasarkan akurasi
            .slice(0, maxPositions);  // Ambil sejumlah terbaik
    }

    /**
     * Hitung rata-rata tertimbang berdasarkan akurasi
     * @param {Array} positions - Array posisi untuk dihitung
     * @returns {Object|null} Hasil perhitungan atau null jika tidak valid
     */
    calculateWeightedAverage(positions) {
        let totalLat = 0, totalLng = 0, totalAcc = 0;
        let weightSum = 0;

        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            // Validasi bahwa posisi ini memiliki akurasi yang valid
            if (typeof pos.acc === 'number' && pos.acc > 0) {
                const weight = 1 / pos.acc; // Bobot berdasarkan akurasi (akurasi lebih baik = bobot lebih tinggi)
                totalLat += pos.lat * weight;
                totalLng += pos.lng * weight;
                totalAcc += pos.acc * weight;
                weightSum += weight;
            }
        }

        if (weightSum > 0) {
            return {
                lat: totalLat / weightSum,
                lng: totalLng / weightSum,
                acc: Math.round(totalAcc / weightSum),
                altitude: positions[0].altitude, // Gunakan dari pembacaan terbaik
                altitudeAccuracy: positions[0].altitudeAccuracy,
                speed: positions[0].speed,
                heading: positions[0].heading,
                timestamp: positions[0].timestamp
            };
        }
        return null;
    }

    /**
     * Validasi apakah hasil kalkulasi lokasi valid
     * @param {Object} location - Lokasi hasil kalkulasi
     * @returns {boolean} Apakah lokasi valid
     */
    isValidCalculatedLocation(location) {
        return !(isNaN(location.lat) || isNaN(location.lng) || isNaN(location.acc));
    }

    /**
     * Dapatkan fallback default ketika lokasi tidak valid
     * @returns {Object} Lokasi fallback default
     */
    getDefaultLocationFallback() {
        return this.bestLocation || {
            lat: 0,
            lng: 0,
            acc: 0,
            altitude: null,
            altitudeAccuracy: null,
            speed: null,
            heading: null,
            timestamp: Date.now()
        };
    }

    /**
     * Dapatkan fallback ketika perhitungan tidak valid
     * @param {Array} bestPositions - Posisi terbaik yang digunakan dalam perhitungan
     * @returns {Object} Lokasi fallback
     */
    getInvalidCalculationFallback(bestPositions) {
        console.warn("calculateRefinedLocation menghasilkan nilai tidak valid, menggunakan bestLocation sebagai fallback", {
            originalBestPositions: bestPositions,
            calculatedResult: null
        });
        return this.getDefaultLocationFallback();
    }

    /**
     * Dapatkan fallback berdasarkan akurasi terbaik dari seluruh riwayat
     * @returns {Object|null} Posisi dengan akurasi terbaik atau null jika tidak ditemukan
     */
    getFallbackByBestAccuracy() {
        const bestByAccuracy = this.positionHistory.reduce((best, current) =>
            (current.acc > 0 && (!best || current.acc < best.acc)) ? current : best, null);

        if (!bestByAccuracy) {
            console.warn("calculateRefinedLocation tidak menemukan posisi valid, menggunakan bestLocation atau default", {
                positionHistory: this.positionHistory,
                bestLocation: this.bestLocation
            });
        }

        return bestByAccuracy;
    }

    updateLocationDisplay(location) {
        // Validasi bahwa location valid
        if (!location) {
            if (this.dom.lblGeo) {
                this.dom.lblGeo.innerHTML = `<i class="ph ph-warning text-red-400" aria-hidden="true"></i> Lokasi tidak tersedia`;
            }
            return;
        }

        // Tampilkan lokasi saat ini dengan indikator apakah sudah stabil atau belum
        const stabilityIndicator = this.isLocationStable ?
            '<i class="ph ph-map-pin text-green-400" aria-hidden="true"></i>' :
            '<i class="ph ph-map-pin text-blue-400" aria-hidden="true"></i>';

        // Pastikan location.lat dan location.lng adalah angka sebelum memformat
        // Konversi dari string ke angka jika perlu
        const latValue = typeof location.lat === 'string' ? parseFloat(location.lat) : location.lat;
        const lngValue = typeof location.lng === 'string' ? parseFloat(location.lng) : location.lng;
        const accValue = typeof location.acc === 'string' ? parseFloat(location.acc) : location.acc;

        const lat = typeof latValue === 'number' && !isNaN(latValue) ? latValue.toFixed(this.config.DEFAULT_COORDINATE_PRECISION) : '0.000000';
        const lng = typeof lngValue === 'number' && !isNaN(lngValue) ? lngValue.toFixed(this.config.DEFAULT_COORDINATE_PRECISION) : '0.000000';
        const acc = typeof accValue === 'number' && !isNaN(accValue) ? Math.round(accValue) : 0;

        if (this.dom.lblGeo) {
            this.dom.lblGeo.innerHTML = `${stabilityIndicator} ${lat}, ${lng} (±${acc}m)`;
        }
    }
    
    /**
     * Handle location refresh request by updating state with latest available location
     */
    handleLocationRefreshRequest() {
        // If we have a best location (either stable or best known), update the state
        if (this.bestLocation) {
            // Update the state with the most recent best location
            // Ensure consistency by using the same format for all location data
            this.state.location = {
                lat: this.bestLocation.lat,
                lng: this.bestLocation.lng,
                acc: this.bestLocation.acc,
                altitude: this.bestLocation.altitude,
                altitudeAccuracy: this.bestLocation.altitudeAccuracy,
                speed: this.bestLocation.speed,
                heading: this.bestLocation.heading
            };

            // Update the display with the current best location
            this.updateLocationDisplay(this.bestLocation);
        }
    }
    
    /**
     * Pause location tracking
     */
    pause() {
        if (this.state.watchId) {
            navigator.geolocation.clearWatch(this.state.watchId);
            this.state.watchId = null;
        }
        // Clear any existing timers
        if (this.locationTimer) {
            clearTimeout(this.locationTimer);
            this.locationTimer = null;
        }

        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
            this.updateDebounceTimer = null;
        }
    }

    /**
     * Resume location tracking
     */
    resume() {
        if (!this.state.watchId) {
            this.init();
        }
    }

    /**
     * Check if location service is active
     */
    isActive() {
        return !!this.state.watchId;
    }

    /**
     * Cleanup location service resources
     */
    destroy() {
        // Clear geolocation watcher
        if (this.state.watchId) {
            navigator.geolocation.clearWatch(this.state.watchId);
            this.state.watchId = null;
        }

        // Clear any existing timers
        if (this.locationTimer) {
            clearTimeout(this.locationTimer);
            this.locationTimer = null;
        }

        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
            this.updateDebounceTimer = null;
        }

        // Reset internal state
        this.resetLocationStatus();
    }
}