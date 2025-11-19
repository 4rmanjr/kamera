/**
 * Virtual Gallery Component
 * Implements high-performance virtual scrolling for galleries.
 * This version uses requestAnimationFrame for throttling and DOM element recycling.
 */

export class VirtualGallery {
    constructor(container, items = [], options = {}) {
        this.container = container;
        this.items = items;
        this.options = {
            itemHeight: options.itemHeight || 150,
            itemRenderer: options.itemRenderer || this.defaultItemRenderer,
            onItemSelect: options.onItemSelect || (() => {}),
        };

        this.scrollTop = 0;
        this.ticking = false; // Flag for scroll throttling

        // DOM elements
        this.viewport = document.createElement('div');
        this.content = document.createElement('div');
        this.itemsContainer = document.createElement('div');
        
        // Node pool for DOM recycling
        this.nodePool = [];
        this.visibleNodeCount = 0;

        this.initDOM();
        this.calculateGrid();
        this.initNodePool();
        
        this.update(); // Initial render
    }

    initDOM() {
        this.viewport.style.position = 'relative';
        this.viewport.style.overflowY = 'auto';
        this.viewport.style.height = '100%';
        this.container.appendChild(this.viewport);
        
        this.content.style.position = 'relative';
        this.content.style.overflow = 'hidden';
        this.viewport.appendChild(this.content);
        
        this.itemsContainer.style.position = 'absolute';
        this.itemsContainer.style.top = '0';
        this.itemsContainer.style.left = '0';
        this.itemsContainer.style.width = '100%';
        this.itemsContainer.style.display = 'grid'; // Assuming grid layout
        this.content.appendChild(this.itemsContainer);

        this.boundOnScroll = this.onScroll.bind(this);
        this.viewport.addEventListener('scroll', this.boundOnScroll, { passive: true });
    }
    
    calculateGrid() {
        const containerWidth = this.container.clientWidth;
        const itemWidth = this.options.itemHeight; // Assuming square items
        this.itemsPerRow = Math.floor(containerWidth / itemWidth) || 1;
        const visibleRows = Math.ceil(this.viewport.clientHeight / this.options.itemHeight) + 1; // +1 buffer row
        this.visibleNodeCount = visibleRows * this.itemsPerRow;
        
        this.itemsContainer.style.gridTemplateColumns = `repeat(${this.itemsPerRow}, 1fr)`;
    }

    initNodePool() {
        for (let i = 0; i < this.visibleNodeCount; i++) {
            const node = this.options.itemRenderer(null, i); // Create placeholder node
            node.style.position = 'absolute';
            node.style.height = `${this.options.itemHeight}px`;
            node.style.width = `${100 / this.itemsPerRow}%`;
            this.itemsContainer.appendChild(node);
            this.nodePool.push(node);
        }
    }

    onScroll() {
        this.scrollTop = this.viewport.scrollTop;
        if (!this.ticking) {
            window.requestAnimationFrame(() => {
                this.update();
                this.ticking = false;
            });
            this.ticking = true;
        }
    }

    update() {
        const totalRows = Math.ceil(this.items.length / this.itemsPerRow);
        const totalHeight = totalRows * this.options.itemHeight;
        this.content.style.height = `${totalHeight}px`;

        const firstVisibleRow = Math.floor(this.scrollTop / this.options.itemHeight);
        const firstVisibleIndex = firstVisibleRow * this.itemsPerRow;

        for (let i = 0; i < this.visibleNodeCount; i++) {
            const itemIndex = firstVisibleIndex + i;
            const node = this.nodePool[i];
            
            if (itemIndex < this.items.length) {
                const item = this.items[itemIndex];
                node.style.display = 'block';

                // Update node content
                const img = node.querySelector('img');
                if (img) {
                    img.dataset.src = item.data;
                    img.alt = `Foto galeri ${item.id}`;
                    this.loadImageWhenVisible(img);
                }
                node.dataset.itemId = item.id; // For click handler
                node.onclick = () => this.options.onItemSelect(item, itemIndex);

                // Update node position
                const row = Math.floor(itemIndex / this.itemsPerRow);
                const col = itemIndex % this.itemsPerRow;
                node.style.transform = `translateY(${row * this.options.itemHeight}px)`;
                node.style.left = `${col * (100 / this.itemsPerRow)}%`;

            } else {
                node.style.display = 'none';
            }
        }
    }

    loadImageWhenVisible(img) {
        const src = img.dataset.src;
        if (src && img.src !== src) { // Avoid reloading
            img.src = src;
            img.onload = () => {
                img.removeAttribute('data-src');
                img.style.opacity = '1';
            };
        }
    }

    defaultItemRenderer() {
        const div = document.createElement('div');
        div.className = 'aspect-square bg-gray-900 relative border border-gray-800 cursor-pointer overflow-hidden';
        div.innerHTML = `<img class="w-full h-full object-cover opacity-0 transition-opacity duration-300" loading="lazy">`;
        return div;
    }

    destroy() {
        this.viewport.removeEventListener('scroll', this.boundOnScroll);
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}