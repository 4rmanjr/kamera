/**
 * Notification Service Module
 * Mengelola notifikasi global untuk aplikasi
 */

export class NotificationService {
    constructor({ dom, eventBus }) {
        this.dom = dom;
        this.eventBus = eventBus;
        this.notifications = []; // Antrian notifikasi
        this.currentNotification = null;
        this.notificationContainer = null;
        this.maxQueueSize = 5; // Maksimum 5 notifikasi dalam antrian
        this.createNotificationContainer();
        
        // Subscribe ke event notifikasi
        this.eventBus.subscribe('notification:show', (data) => {
            const { message, type = 'info', duration = 3000 } = data;
            this.show(message, type, duration);
        });
    }

    createNotificationContainer() {
        // Membuat kontainer notifikasi jika belum ada
        this.notificationContainer = document.getElementById('notification-container');
        if (!this.notificationContainer) {
            this.notificationContainer = document.createElement('div');
            this.notificationContainer.id = 'notification-container';
            this.notificationContainer.className = 'fixed top-4 right-4 z-[9999] space-y-2 w-auto max-w-xs';
            document.body.appendChild(this.notificationContainer);
        }
    }

    show(message, type = 'info', duration = 3000) {
        // Tipe notifikasi: info, success, warning, error
        const notification = {
            id: Date.now() + Math.random(),
            message,
            type,
            duration
        };

        // Cek apakah antrian sudah mencapai batas maksimum
        if (this.notifications.length >= this.maxQueueSize) {
            // Hapus notifikasi tertua jika sudah mencapai batas maksimum
            this.notifications.shift();
        }

        this.notifications.push(notification);
        this.processQueue();
    }

    processQueue() {
        // Jika tidak ada notifikasi yang sedang aktif dan ada notifikasi dalam antrian
        if (!this.currentNotification && this.notifications.length > 0) {
            this.currentNotification = this.notifications.shift();
            this.displayNotification();
        }
    }

    displayNotification() {
        if (!this.currentNotification) return;

        const { message, type, id, duration } = this.currentNotification;
        
        // Membuat elemen notifikasi
        const notificationEl = document.createElement('div');
        notificationEl.className = 'notification-item notification-base px-4 py-3 rounded-lg shadow-lg mb-2 transform transition-all duration-300 ease-in-out opacity-0 translate-y-4';
        
        notificationEl.classList.add(`notification-${type}`);
        
        notificationEl.id = `notification-${id}`;
        notificationEl.innerHTML = `
            <div class="flex items-start">
                <span class="mr-2 font-bold">${this.getIcon(type)}</span>
                <span class="flex-1">${message}</span>
                <button class="close-btn text-lg bg-transparent border-none text-white cursor-pointer ml-2">×</button>
            </div>
        `;

        // Tambahkan ke container
        this.notificationContainer.appendChild(notificationEl);

        // Tambahkan efek muncul
        setTimeout(() => {
            notificationEl.classList.remove('opacity-0', 'translate-y-4');
            notificationEl.classList.add('opacity-100', 'translate-y-0');
        }, 10);

        // Tambahkan event listener untuk tombol close
        const closeBtn = notificationEl.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                this.removeNotification(notificationEl);
            };
        }

        // Atur timeout untuk menghilangkan notifikasi
        setTimeout(() => {
            this.removeNotification(notificationEl);
        }, duration);
    }

    getIcon(type) {
        switch (type) {
            case 'success': return '✓';
            case 'warning': return '⚠';
            case 'error': return '✗';
            case 'info':
            default: return 'ℹ';
        }
    }

    removeNotification(notificationEl) {
        if (notificationEl) {
            notificationEl.classList.remove('opacity-100', 'translate-y-0');
            notificationEl.classList.add('opacity-0', 'translate-y-4');
            
            // Hapus dari DOM setelah animasi selesai
            setTimeout(() => {
                if (notificationEl.parentNode) {
                    notificationEl.parentNode.removeChild(notificationEl);
                }
                
                // Tandai bahwa tidak ada notifikasi aktif
                this.currentNotification = null;
                
                // Proses antrian berikutnya
                this.processQueue();
            }, 300);
        }
    }
}