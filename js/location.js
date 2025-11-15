/**
 * Location Service Module (Enhanced Real-Time Performance & Accuracy)
 * Mengelola fungsionalitas geolokasi dengan akurasi dan performa real-time yang lebih baik
 */

export class LocationService {
    constructor({ state, dom, eventBus }) {
        this.state = state;
        this.dom = dom;
        this.eventBus = eventBus;

        // Konfigurasi performa real-time
        this.MIN_ACCURACY = 25; // Akurasi target dalam meter
        this.BEST_LOCATION_TIMEOUT = 12000; // 12 detik untuk mencari posisi terbaik (lebih cepat)
        this.MOVEMENT_THRESHOLD = 10; // Meter - ambang perubahan posisi yang signifikan
        this.UPDATE_DEBOUNCE = 500; // Milidetik - lebih cepat untuk update UI real-time
        this.POSITION_HISTORY_SIZE = 15; // Lebih banyak riwayat untuk akurasi lebih baik
        this.FAST_ACQUISITION_TIMEOUT = 3000; // Waktu awal untuk akuisisi cepat

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
        this.consistencyDebounceTime = 1000; // 1 detik, mencegah perhitungan berlebihan
        
        // Subscribe to location refresh requests
        this.eventBus.subscribe('location:requestRefresh', () => {
            this.handleLocationRefreshRequest();
        });
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
                    timeout: 45000, // Lebih pendek dari sebelumnya untuk respons lebih cepat
                    maximumAge: 0,
                    distanceFilter: 3 // Lebih kecil dari sebelumnya untuk deteksi perubahan halus
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
        // Validasi bahwa position dan coords valid
        if (!position || !position.coords) {
            return;
        }

        const currentLocation = {
            lat: parseFloat(position.coords.latitude),
            lng: parseFloat(position.coords.longitude),
            acc: Math.round(position.coords.accuracy),
            timestamp: position.timestamp,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            speed: position.coords.speed,
            heading: position.coords.heading
        };

        // Validasi bahwa nilai-nilai penting valid
        if (isNaN(currentLocation.lat) || isNaN(currentLocation.lng)) {
            return;
        }

        // Hanya proses jika akurasi masuk akal
        if (currentLocation.acc > 1000 || currentLocation.acc <= 0) {
            // Akurasi terlalu buruk atau tidak valid, abaikan
            return;
        }

        // Tambahkan ke riwayat
        this.positionHistory.push(currentLocation);
        if (this.positionHistory.length > this.POSITION_HISTORY_SIZE) {
            this.positionHistory.shift(); // Hapus item tertua
        }

        // Update best location jika diperlukan
        const isNewBestLocation = !this.bestLocation || this.isBetterLocation(currentLocation, this.bestLocation);
        if (isNewBestLocation) {
            this.bestLocation = currentLocation;
        }

        // Update tampilan UI hanya jika ini adalah best location baru dan kita dalam mode tidak stabil
        if (isNewBestLocation || !this.isLocationStable) {
            const now = Date.now();
            if (now - this.lastUpdateTime > this.UPDATE_DEBOUNCE) {
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
                }, this.UPDATE_DEBOUNCE);
            }
        }

        // Cek apakah lokasi sudah cukup stabil atau akurat
        if (!this.isLocationStable && this.bestLocation) {
            // Aktifkan mode akuisisi cepat untuk 3 detik pertama
            if (this.fastAcquisitionActive && (Date.now() - this.initialAcquisitionStartTime) > this.FAST_ACQUISITION_TIMEOUT) {
                this.fastAcquisitionActive = false;
            }

            // Cek apakah kita sudah mendapatkan lokasi yang cukup akurat
            if (this.bestLocation.acc <= this.MIN_ACCURACY) {
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
                    }, this.BEST_LOCATION_TIMEOUT);
                }
            } else {
                // Jika belum akurat, tetap atur timer sebagai fallback jika belum ada
                if (this.locationTimer === null || this.locationTimer === undefined) {
                    this.locationTimer = setTimeout(() => {
                        this.makeLocationStable();
                    }, this.BEST_LOCATION_TIMEOUT);
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
            return accuracyImprovement > 5 || accuracyRatio > 1.2;
        }

        // Lokasi baru lebih baik jika:
        // 1. Akurasinya jauh lebih baik (lebih kecil)
        // 2. Akurasinya lebih baik dan tidak jauh lebih lama
        if (accuracyImprovement > 20 || accuracyRatio > 1.5) {
            return true;
        }

        // Jika akurasinya serupa, pilih yang punya akurasi lebih baik
        if (Math.abs(accuracyImprovement) < 10) {
            return true; // Karena kita sudah tahu newAcc < currentAcc dari awal
        }

        return false;
    }

    // Cek konsistensi lokasi berdasarkan riwayat
    isLocationConsistent() {
        if (!this.positionHistory || this.positionHistory.length < 5) {
            return false; // Perlu cukup data untuk menilai konsistensi
        }

        // Cek apakah kita bisa menggunakan cache untuk menghindari perhitungan berulang
        const now = Date.now();
        const recentPositions = this.positionHistory.slice(-5);
        
        // Buat hash dari posisi terbaru untuk menentukan apakah perlu menghitung ulang
        // Gunakan presisi lebih tinggi untuk deteksi perubahan kecil
        const positionHash = recentPositions.map(pos => 
            `${pos.lat.toFixed(10)},${pos.lng.toFixed(10)},${pos.acc}`
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
        const distanceThreshold = this.MOVEMENT_THRESHOLD / 111000; // Dalam derajat (111km per derajat)

        // Gunakan aproach yang lebih efisien untuk menghitung jarak dalam skala kecil
        // Lakukan early exit jika sudah ditemukan cukup banyak posisi yang tidak konsisten
        const requiredConsistent = 3; // Jumlah minimum yang diperlukan untuk konsistensi
        const maxInconsistent = recentPositions.length - requiredConsistent; // Jumlah maksimum yang bisa tidak konsisten
        let inconsistentCount = 0;

        for (const pos of recentPositions) {
            const distance = this.calculateDistanceFast(avgLat, avgLng, pos.lat, pos.lng);
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
            result: consistentCount >= 3,
            timestamp: now
        };

        // Jika sebagian besar pembacaan konsisten, anggap lokasi stabil
        return this.lastConsistencyCheck.result;
    }

    // Fungsi untuk menghitung jarak antara dua titik (dalam km)
    calculateDistance(lat1, lng1, lat2, lng2) {
        // Validasi input
        if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
            return Infinity; // Jika input tidak valid, kembalikan jarak tak terhingga
        }

        const R = 6371; // Radius bumi dalam km
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lng2 - lng1);
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Jarak dalam km
    }

    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    // Fungsi untuk menghitung jarak antara dua titik secara cepat untuk jarak pendek
    // Menggunakan pendekatan equirectangular projection yang lebih cepat untuk jarak kecil
    calculateDistanceFast(lat1, lng1, lat2, lng2) {
        // Validasi input
        if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
            return Infinity; // Jika input tidak valid, kembalikan jarak tak terhingga
        }

        // Periksa apakah ini benar-benar jarak pendek sebelum menggunakan metode cepat
        // Jika perbedaan koordinat besar, kembali ke perhitungan yang lebih akurat
        const latDiff = Math.abs(lat2 - lat1);
        const lngDiff = Math.abs(lng2 - lng1);
        
        // Jika perbedaan lebih dari 0.1 derajat (sekitar 11km), gunakan metode yang lebih akurat
        if (latDiff > 0.1 || lngDiff > 0.1) {
            return this.calculateDistance(lat1, lng1, lat2, lng2);
        }

        const R = 6371; // Radius bumi dalam km
        const lat1Rad = this.toRadians(lat1);
        const lat2Rad = this.toRadians(lat2);
        const avgLat = (lat1Rad + lat2Rad) / 2;
        
        // Konversi perbedaan koordinat ke radian
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        
        // Equirectangular projection - lebih cepat daripada Haversine untuk jarak kecil
        const x = dLng * Math.cos(avgLat);
        const distance = R * Math.sqrt(x * x + dLat * dLat);
        
        return Math.abs(distance); // Jarak dalam km
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
                this.dom.lblGeo.innerHTML = `<i class="ph ph-map-pin text-green-400" aria-hidden="true"></i> ${refinedLocation.lat.toFixed(6)}, ${refinedLocation.lng.toFixed(6)} (±${refinedLocation.acc}m)`;
            }

            // Simpan lokasi stabil ke state
            this.state.location = {
                lat: refinedLocation.lat.toFixed(6),
                lng: refinedLocation.lng.toFixed(6),
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
        // Gunakan pendekatan yang lebih efisien daripada full sort: partial selection
        const maxPositions = Math.min(7, this.positionHistory.length);
        const bestPositions = this.positionHistory
            .slice() // Buat salinan array agar tidak mengubah aslinya
            .sort((a, b) => a.acc - b.acc)  // Urutkan berdasarkan akurasi
            .slice(0, maxPositions);  // Ambil sejumlah terbaik

        // Validasi bahwa kita punya posisi valid untuk diproses
        if (bestPositions.length === 0) {
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

        // Hitung rata-rata tertimbang berdasarkan akurasi
        let totalLat = 0, totalLng = 0, totalAcc = 0;
        let weightSum = 0;

        for (let i = 0; i < bestPositions.length; i++) {
            const pos = bestPositions[i];
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
            const result = {
                lat: totalLat / weightSum,
                lng: totalLng / weightSum,
                acc: Math.round(totalAcc / weightSum),
                altitude: bestPositions[0].altitude, // Gunakan dari pembacaan terbaik
                altitudeAccuracy: bestPositions[0].altitudeAccuracy,
                speed: bestPositions[0].speed,
                heading: bestPositions[0].heading,
                timestamp: bestPositions[0].timestamp
            };
            
            // Validasi hasil akhir untuk memastikan semuanya valid
            if (isNaN(result.lat) || isNaN(result.lng) || isNaN(result.acc)) {
                console.warn("calculateRefinedLocation menghasilkan nilai tidak valid, menggunakan bestLocation sebagai fallback", {
                    originalBestPositions: bestPositions,
                    calculatedResult: result
                });
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
            
            return result;
        } else {
            // Jika weightSum adalah 0 karena semua posisi memiliki akurasi tak valid
            // kembalikan bestLocation atau posisi terbaik berdasarkan akurasi
            const bestByAccuracy = this.positionHistory.reduce((best, current) => 
                (current.acc > 0 && (!best || current.acc < best.acc)) ? current : best, null);
                
            if (!bestByAccuracy) {
                console.warn("calculateRefinedLocation tidak menemukan posisi valid, menggunakan bestLocation atau default", {
                    positionHistory: this.positionHistory,
                    bestLocation: this.bestLocation
                });
            }
            
            return bestByAccuracy || this.bestLocation || {
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

        const lat = typeof latValue === 'number' && !isNaN(latValue) ? latValue.toFixed(6) : '0.000000';
        const lng = typeof lngValue === 'number' && !isNaN(lngValue) ? lngValue.toFixed(6) : '0.000000';
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