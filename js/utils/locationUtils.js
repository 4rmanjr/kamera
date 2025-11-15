/**
 * Location Utilities Module
 * Fungsi-fungsi utilitas untuk operasi lokasi
 */

// Kita tidak gunakan geolib karena kita prioritaskan performa dan ukuran bundle kecil
// Fungsi manual lebih ringan untuk operasi sederhana seperti ini

export class LocationUtils {
    /**
     * Fungsi untuk menghitung jarak antara dua titik (dalam km)
     * @param {number} lat1 - Latitude pertama dalam derajat desimal
     * @param {number} lng1 - Longitude pertama dalam derajat desimal
     * @param {number} lat2 - Latitude kedua dalam derajat desimal
     * @param {number} lng2 - Longitude kedua dalam derajat desimal
     * @returns {number} Jarak dalam kilometer
     */
    static calculateDistance(lat1, lng1, lat2, lng2) {
        // Validasi input
        if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
            return Infinity; // Jika input tidak valid, kembalikan jarak tak terhingga
        }

        const R = 6371; // Radius bumi dalam km
        const dLat = LocationUtils.toRadians(lat2 - lat1);
        const dLon = LocationUtils.toRadians(lng2 - lng1);
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(LocationUtils.toRadians(lat1)) * Math.cos(LocationUtils.toRadians(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Jarak dalam km
    }

    /**
     * Fungsi untuk menghitung jarak antara dua titik secara cepat untuk jarak pendek
     * Menggunakan pendekatan equirectangular projection yang lebih cepat untuk jarak kecil
     * @param {number} lat1 - Latitude pertama dalam derajat desimal
     * @param {number} lng1 - Longitude pertama dalam derajat desimal
     * @param {number} lat2 - Latitude kedua dalam derajat desimal
     * @param {number} lng2 - Longitude kedua dalam derajat desimal
     * @returns {number} Jarak dalam kilometer
     */
    static calculateDistanceFast(lat1, lng1, lat2, lng2) {
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
            return LocationUtils.calculateDistance(lat1, lng1, lat2, lng2);
        }

        const R = 6371; // Radius bumi dalam km
        const lat1Rad = LocationUtils.toRadians(lat1);
        const lat2Rad = LocationUtils.toRadians(lat2);
        const avgLat = (lat1Rad + lat2Rad) / 2;

        // Konversi perbedaan koordinat ke radian
        const dLat = LocationUtils.toRadians(lat2 - lat1);
        const dLng = LocationUtils.toRadians(lng2 - lng1);

        // Equirectangular projection - lebih cepat daripada Haversine untuk jarak kecil
        const x = dLng * Math.cos(avgLat);
        const distance = R * Math.sqrt(x * x + dLat * dLat);

        return Math.abs(distance); // Jarak dalam km
    }

    /**
     * Konversi derajat ke radian
     * @param {number} degrees - Nilai dalam derajat
     * @returns {number} Nilai dalam radian
     */
    static toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * Format koordinat ke presisi tertentu
     * @param {number} coordinate - Koordinat untuk diformat
     * @param {number} precision - Jumlah desimal (default: 6)
     * @returns {string} Koordinat yang diformat
     */
    static formatCoordinate(coordinate, precision = 6) {
        if (typeof coordinate !== 'number' || isNaN(coordinate)) {
            return '0.000000';
        }
        return coordinate.toFixed(precision);
    }

    /**
     * Validasi apakah koordinat valid
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {boolean} Apakah koordinat valid
     */
    static isValidCoordinate(lat, lng) {
        return !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
    }

    /**
     * Validasi apakah akurasi valid
     * @param {number} acc - Akurasi dalam meter
     * @returns {boolean} Apakah akurasi valid
     */
    static isValidAccuracy(acc) {
        return typeof acc === 'number' && acc > 0 && acc <= 1000;
    }
}