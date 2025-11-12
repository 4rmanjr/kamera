/**
 * Location Service Module (Enhanced Performance & Accuracy - Bug Fixed)
 * Mengelola fungsionalitas geolokasi dengan akurasi dan performa yang lebih baik
 */

export class LocationService {
    constructor({ state, dom, eventBus }) {
        this.state = state;
        this.dom = dom;
        this.eventBus = eventBus;

        // Konfigurasi performa
        this.MIN_ACCURACY = 25; // Akurasi target dalam meter
        this.BEST_LOCATION_TIMEOUT = 15000; // 15 detik untuk mencari posisi terbaik sebelum stabil
        this.MOVEMENT_THRESHOLD = 10; // Meter - ambang perubahan posisi yang signifikan
        this.UPDATE_DEBOUNCE = 1000; // Milidetik - mencegah terlalu banyak update UI
        this.POSITION_HISTORY_SIZE = 10; // Jumlah pembacaan lokasi terakhir untuk perhitungan rata-rata

        // Status internal
        this.bestLocation = null;
        this.isLocationStable = false;
        this.locationTimer = null;
        this.updateDebounceTimer = null;
        this.positionHistory = [];
        this.lastUpdateTime = 0;
    }

    init() {
        if ("geolocation" in navigator) {
            // Reset status lokasi
            this.resetLocationStatus();

            // Tampilkan status awal
            this.dom.lblGeo.innerHTML = `<i class="ph ph-spinner animate-spin mr-1" aria-hidden="true"></i> Mengoptimalkan GPS...`;

            this.state.watchId = navigator.geolocation.watchPosition(
                (p) => {
                    this.processLocationUpdate(p);
                },
                (err) => {
                    this.handleLocationError(err);
                },
                { 
                    enableHighAccuracy: true, 
                    timeout: 60000, // Lebih lama untuk akurasi tinggi
                    maximumAge: 0,
                    distanceFilter: 5 // Hanya menerima update saat berpindah 5 meter
                }
            );
        } else {
            this.dom.lblGeo.innerText = "GPS Tidak Didukung";
        }
    }

    resetLocationStatus() {
        this.isLocationStable = false;
        this.bestLocation = null;
        this.positionHistory = [];

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

        this.dom.lblGeo.innerHTML = `<i class="ph ph-warning text-red-400" aria-hidden="true"></i> ${errorMessage} (Tap untuk Ulang)`;
        this.dom.lblGeo.onclick = () => {
            this.dom.lblGeo.innerHTML = `<i class="ph ph-spinner animate-spin mr-1" aria-hidden="true"></i> Mencari GPS...`;
            this.init();
        };
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
        if (!this.bestLocation || this.isBetterLocation(currentLocation, this.bestLocation)) {
            this.bestLocation = currentLocation;
        }

        // Update tampilan UI dengan debounce
        const now = Date.now();
        if (now - this.lastUpdateTime > this.UPDATE_DEBOUNCE) {
            this.updateLocationDisplay(this.bestLocation);
            this.lastUpdateTime = now;
        } else {
            // Gunakan timer untuk update nanti jika belum waktunya
            if (this.updateDebounceTimer) {
                clearTimeout(this.updateDebounceTimer);
            }
            
            // Bind context sehingga 'this' tetap merujuk ke instance class di dalam fungsi setTimeout
            this.updateDebounceTimer = setTimeout(() => {
                this.updateLocationDisplay(this.bestLocation);
                this.lastUpdateTime = Date.now();
            }, this.UPDATE_DEBOUNCE);
        }

        // Cek apakah lokasi sudah cukup stabil atau akurat
        if (!this.isLocationStable && this.bestLocation) {
            // Mulai timer untuk menandai lokasi sebagai stabil setelah waktu tertentu
            if (!this.locationTimer) {
                this.locationTimer = setTimeout(() => {
                    this.makeLocationStable();
                }, this.BEST_LOCATION_TIMEOUT);
            }

            // Cek apakah kita sudah mendapatkan lokasi yang cukup akurat
            if (this.bestLocation.acc <= this.MIN_ACCURACY) {
                // Tambahkan validasi: pastikan beberapa pembacaan terakhir konsisten
                if (this.isLocationConsistent()) {
                    this.makeLocationStable();
                }
            }
        }
    }

    // Fungsi untuk menentukan apakah lokasi baru lebih baik dari yang sekarang
    isBetterLocation(newLocation, currentBest) {
        // Validasi bahwa kedua lokasi valid
        if (!newLocation || !currentBest) {
            return !currentBest; // Jika currentBest null, maka newLocation lebih baik
        }

        // Validasi akurasi
        if (!newLocation.acc || !currentBest.acc) {
            return false; // Jika salah satu tidak memiliki akurasi, jangan ganti
        }

        // Lokasi baru lebih baik jika:
        // 1. Akurasinya jauh lebih baik (lebih kecil)
        // 2. Akurasinya lebih baik dan tidak jauh lebih lama
        const accuracyImprovement = currentBest.acc - newLocation.acc;
        const accuracyRatio = currentBest.acc / (newLocation.acc || 1);
        
        if (accuracyImprovement > 20 || accuracyRatio > 1.5) {
            return true;
        }
        
        // Jika akurasinya serupa, pilih yang punya akurasi lebih baik
        if (Math.abs(accuracyImprovement) < 10) {
            return newLocation.acc < currentBest.acc;
        }
        
        return false;
    }

    // Cek konsistensi lokasi berdasarkan riwayat
    isLocationConsistent() {
        if (!this.positionHistory || this.positionHistory.length < 5) {
            return false; // Perlu cukup data untuk menilai konsistensi
        }

        // Hitung rata-rata posisi dari beberapa pembacaan terakhir
        const recentPositions = this.positionHistory.slice(-5);
        const avgLat = recentPositions.reduce((sum, pos) => sum + pos.lat, 0) / recentPositions.length;
        const avgLng = recentPositions.reduce((sum, pos) => sum + pos.lng, 0) / recentPositions.length;
        
        // Hitung seberapa dekat pembacaan terbaru dengan rata-rata
        let consistentCount = 0;
        const distanceThreshold = this.MOVEMENT_THRESHOLD / 111000; // Dalam derajat (111km per derajat)

        for (const pos of recentPositions) {
            const distance = this.calculateDistance(avgLat, avgLng, pos.lat, pos.lng);
            if (distance < distanceThreshold) {
                consistentCount++;
            }
        }

        // Jika sebagian besar pembacaan konsisten, anggap lokasi stabil
        return consistentCount >= 3;
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
            this.dom.lblGeo.innerHTML = `<i class="ph ph-map-pin text-green-400" aria-hidden="true"></i> ${refinedLocation.lat.toFixed(6)}, ${refinedLocation.lng.toFixed(6)} (±${refinedLocation.acc}m)`;
            
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
        const bestPositions = [...this.positionHistory]
            .sort((a, b) => a.acc - b.acc)  // Urutkan berdasarkan akurasi
            .slice(0, Math.min(5, this.positionHistory.length));  // Ambil 5 terbaik atau semua jika kurang

        // Hitung rata-rata tertimbang berdasarkan akurasi
        let totalLat = 0, totalLng = 0, totalAcc = 0;
        let weightSum = 0;

        for (const pos of bestPositions) {
            const weight = 1 / (pos.acc || 1); // Bobot berdasarkan akurasi (akurasi lebih baik = bobot lebih tinggi)
            totalLat += pos.lat * weight;
            totalLng += pos.lng * weight;
            totalAcc += pos.acc * weight;
            weightSum += weight;
        }

        if (weightSum > 0) {
            return {
                lat: totalLat / weightSum,
                lng: totalLng / weightSum,
                acc: Math.round(totalAcc / weightSum),
                altitude: bestPositions[0].altitude, // Gunakan dari pembacaan terbaik
                altitudeAccuracy: bestPositions[0].altitudeAccuracy,
                speed: bestPositions[0].speed,
                heading: bestPositions[0].heading,
                timestamp: bestPositions[0].timestamp
            };
        } else {
            // Jika weightSum adalah 0, kembalikan bestLocation untuk mencegah NaN
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
    }

    updateLocationDisplay(location) {
        // Validasi bahwa location valid
        if (!location) {
            this.dom.lblGeo.innerHTML = `<i class="ph ph-warning text-red-400" aria-hidden="true"></i> Lokasi tidak tersedia`;
            return;
        }
        
        // Tampilkan lokasi saat ini dengan indikator apakah sudah stabil atau belum
        const stabilityIndicator = this.isLocationStable ? 
            '<i class="ph ph-map-pin text-green-400" aria-hidden="true"></i>' : 
            '<i class="ph ph-map-pin text-blue-400" aria-hidden="true"></i>';
            
        // Pastikan location.lat dan location.lng adalah angka sebelum memformat
        const lat = typeof location.lat === 'number' ? location.lat.toFixed(6) : '0.000000';
        const lng = typeof location.lng === 'number' ? location.lng.toFixed(6) : '0.000000';
        const acc = typeof location.acc === 'number' ? location.acc : 0;
        
        this.dom.lblGeo.innerHTML = `${stabilityIndicator} ${lat}, ${lng} (±${acc}m)`;
    }
}