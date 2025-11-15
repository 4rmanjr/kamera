/**
 * Virtual Gallery Component
 * Mengimplementasikan virtual scrolling untuk galeri dengan performa tinggi
 */

export class VirtualGallery {
    /**
     * Membuat instance VirtualGallery
     * @param {HTMLElement} container - Elemen kontainer untuk galeri
     * @param {Array} items - Array item yang akan ditampilkan
     * @param {Object} options - Opsi konfigurasi
     */
    constructor(container, items = [], options = {}) {
        this.container = container;
        this.items = items;
        this.options = {
            itemHeight: options.itemHeight || 120, // Tinggi standar item
            visibleBuffer: options.visibleBuffer || 5, // Jumlah buffer item di atas/bawah
            itemRenderer: options.itemRenderer || this.defaultItemRenderer,
            onItemSelect: options.onItemSelect || (() => {}),
            itemClass: options.itemClass || 'aspect-square bg-gray-900 relative border border-gray-800 cursor-pointer overflow-hidden'
        };
        
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.scrollTop = 0;
        this.clientHeight = container.clientHeight || 400; // Default fallback
        
        // Buat elemen-elemen pendukung
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'relative';
        this.viewport.style.overflow = 'auto';
        this.container.appendChild(this.viewport);
        
        this.content = document.createElement('div');
        this.viewport.appendChild(this.content);
        
        // Buat spacer untuk membuat efek scroll
        this.topSpacer = document.createElement('div');
        this.topSpacer.style.height = '0px';
        this.topSpacer.style.width = '100%';
        this.content.appendChild(this.topSpacer);
        
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.style.display = 'contents';
        this.content.appendChild(this.itemsContainer);
        
        this.bottomSpacer = document.createElement('div');
        this.bottomSpacer.style.height = '0px';
        this.bottomSpacer.style.width = '100%';
        this.content.appendChild(this.bottomSpacer);
        
        // Bind event listener
        this.boundHandleScroll = this.handleScroll.bind(this);
        this.viewport.addEventListener('scroll', this.boundHandleScroll);
        
        // Hitung grid layout
        this.calculateGrid();
    }
    
    /**
     * Menghitung layout grid berdasarkan ukuran container
     */
    calculateGrid() {
        // Jika container adalah grid, kita perlu tahu berapa banyak kolom
        const computedStyle = window.getComputedStyle(this.container);
        if (computedStyle.display === 'grid' || this.container.classList.contains('grid')) {
            // Hitung jumlah kolom berdasarkan grid template
            const gridTemplateColumns = computedStyle.gridTemplateColumns;
            const cols = gridTemplateColumns.split(' ').length || 3; // Default 3 kolom
            this.itemsPerRow = cols;
            this.visibleRows = Math.ceil((this.clientHeight / this.options.itemHeight) + 2);
            this.visibleItems = this.visibleRows * this.itemsPerRow;
        } else {
            // Jika bukan grid, asumsikan 1 item per baris
            this.itemsPerRow = 1;
            this.visibleItems = Math.ceil((this.clientHeight / this.options.itemHeight) + 2);
        }
    }
    
    /**
     * Renderer default untuk item galeri
     */
    defaultItemRenderer(item, index) {
        const div = document.createElement('div');
        div.className = this.options.itemClass;
        div.innerHTML = `<img data-src="${item.data}" class="w-full h-full object-cover opacity-0 transition-opacity duration-300" loading="lazy" alt="Foto galeri ${item.id}">`;
        div.onclick = () => this.options.onItemSelect(item, index);
        return div;
    }
    
    /**
     * Menangani event scroll
     */
    handleScroll() {
        this.scrollTop = this.viewport.scrollTop;
        this.clientHeight = this.viewport.clientHeight;
        
        this.calculateVisibleRange();
        this.renderVisibleItems();
    }
    
    /**
     * Menghitung rentang item yang terlihat
     */
    calculateVisibleRange() {
        const startIndex = Math.floor(this.scrollTop / this.options.itemHeight);
        this.visibleStart = Math.max(0, startIndex - this.options.visibleBuffer);
        this.visibleEnd = Math.min(
            this.items.length,
            this.visibleStart + this.visibleItems + (this.options.visibleBuffer * 2)
        );
    }
    
    /**
     * Merender item-item yang terlihat
     */
    renderVisibleItems() {
        // Hapus item-item sebelumnya
        this.itemsContainer.innerHTML = '';
        
        // Update spacer
        const topSpacerHeight = this.visibleStart * this.options.itemHeight;
        this.topSpacer.style.height = `${topSpacerHeight}px`;
        
        const itemsToRender = this.items.slice(this.visibleStart, this.visibleEnd);
        
        // Tambahkan item yang terlihat
        itemsToRender.forEach((item, index) => {
            const absoluteIndex = this.visibleStart + index;
            const itemElement = this.options.itemRenderer(item, absoluteIndex);
            this.itemsContainer.appendChild(itemElement);
            
            // Aktifkan lazy loading untuk item ini
            if (itemElement.querySelector && itemElement.querySelector('img[data-src]')) {
                this.loadImageWhenVisible(itemElement.querySelector('img[data-src]'));
            }
        });
        
        // Hitung tinggi bottom spacer
        const bottomSpacerHeight = Math.max(0, (this.items.length - this.visibleEnd) * this.options.itemHeight);
        this.bottomSpacer.style.height = `${bottomSpacerHeight}px`;
    }
    
    /**
     * Fungsi untuk memuat gambar saat visible
     */
    loadImageWhenVisible(img) {
        // Implementasi sederhana - sebenarnya bisa menggunakan IntersectionObserver
        const src = img.dataset.src;
        if (src) {
            img.src = src;
            img.onload = () => {
                img.removeAttribute('data-src');
                img.classList.remove('opacity-0');
            };
        }
    }
    
    /**
     * Memperbarui data galeri
     */
    updateData(newItems) {
        this.items = newItems;
        this.calculateGrid();
        this.calculateVisibleRange();
        this.renderVisibleItems();
        
        // Update tinggi total konten
        const totalHeight = this.items.length * this.options.itemHeight;
        this.bottomSpacer.style.height = `${Math.max(0, totalHeight - (this.visibleEnd * this.options.itemHeight))}px`;
    }
    
    /**
     * Mengatur event listener untuk Intersection Observer (opsional)
     */
    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) return;
        
        const observerCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src;
                    if (src) {
                        img.src = src;
                        img.onload = () => {
                            img.removeAttribute('data-src');
                            img.classList.remove('opacity-0');
                        };
                        observer.unobserve(img);
                    }
                }
            });
        };
        
        this.imageObserver = new IntersectionObserver(observerCallback, {
            root: this.viewport,
            rootMargin: '100px' // Muat lebih awal
        });
    }
    
    /**
     * Membersihkan resources
     */
    destroy() {
        if (this.imageObserver) {
            this.imageObserver.disconnect();
        }
        if (this.viewport && this.boundHandleScroll) {
            this.viewport.removeEventListener('scroll', this.boundHandleScroll);
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}