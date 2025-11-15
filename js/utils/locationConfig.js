/**
 * Location Configuration Module
 * Konfigurasi untuk layanan lokasi
 */

export class LocationConfig {
    static get DEFAULT_CONFIG() {
        return {
            // Konfigurasi performa real-time
            MIN_ACCURACY_THRESHOLD: 25,    // Akurasi target dalam meter
            BEST_LOCATION_TIMEOUT_MS: 12000,  // dalam milidetik
            MOVEMENT_THRESHOLD_METERS: 10, // Meter - ambang perubahan posisi yang signifikan
            UPDATE_DEBOUNCE_MS: 500,       // Milidetik - lebih cepat untuk update UI real-time
            POSITION_HISTORY_SIZE: 15,     // Ukuran riwayat posisi
            FAST_ACQUISITION_TIMEOUT_MS: 3000, // Waktu awal untuk akuisisi cepat
            MAX_REASONABLE_ACCURACY: 1000, // Akurasi maksimum yang masuk akal
            DEFAULT_COORDINATE_PRECISION: 6, // Jumlah desimal untuk koordinat
            MIN_ACCURACY_FOR_STABILITY: 25, // Akurasi minimum untuk menandai lokasi stabil
            DEFAULT_TIMEOUT_MS: 45000, // Timeout untuk geolocation API
            DISTANCE_FILTER_METERS: 3, // Filter jarak untuk geolocation API
            MIN_CONSISTENT_POSITIONS_FOR_STABILITY: 3, // Jumlah posisi konsisten untuk stabilitas
            MAX_DEGREES_FOR_FAST_CALCULATION: 0.1, // Batas derajat untuk perhitungan cepat
            CONVERGENCE_FACTOR: 1.5, // Faktor konvergensi untuk menentukan lokasi lebih baik
            IMPROVEMENT_THRESHOLD_FOR_FAST_MODE: 5, // Ambang perbaikan dalam mode cepat
            ACCURACY_RATIO_THRESHOLD_FOR_FAST_MODE: 1.2, // Rasio akurasi dalam mode cepat
            IMPROVEMENT_THRESHOLD_FOR_STABILITY: 20, // Ambang perbaikan akurasi untuk menandai lokasi lebih baik
            SIMILAR_ACCURACY_THRESHOLD: 10, // Ambang untuk menganggap akurasi serupa
            MAX_WEIGHT_SUM_FOR_FALLBACK: 0, // Ambang untuk fallback ke best location
            COORDINATE_PRECISION_FOR_HASH: 10, // Presisi untuk pembuatan hash koordinat
            MAX_INVALID_POSITIONS_IN_ROW: 5, // Maksimum posisi tidak valid berturut-turut
            CONSISTENCY_CHECK_DEBOUNCE_MS: 1000, // Waktu debounce untuk cek konsistensi
            EARTH_RADIUS_KM: 6371, // Radius bumi dalam km
            KM_PER_DEGREE_APPROX: 111000 // Aproksimasi km per derajat
        };
    }
}