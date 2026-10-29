/**
 * VividFrame - Interactive Image Gallery Script
 * Handles theme toggling, search/filtering, lightbox nav, slideshows, swipes, and keyboard controls.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // DOM Element Selection
    // ==========================================================================
    const themeToggleBtn = document.getElementById('theme-toggle');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const galleryGrid = document.getElementById('gallery-grid');
    const galleryItems = document.querySelectorAll('.gallery-item');
    const statusIndicator = document.getElementById('gallery-status');

    // Lightbox Elements
    const lightbox = document.getElementById('lightbox');
    const lightboxOverlay = document.getElementById('lightbox-overlay');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxDesc = document.getElementById('lightbox-desc');
    const lightboxCategory = document.getElementById('lightbox-category');
    const lightboxCounter = document.getElementById('lightbox-counter');
    const lightboxThumbnails = document.getElementById('lightbox-thumbnails');

    // Slideshow Elements
    const playPauseBtn = document.getElementById('slideshow-play-pause');
    const progressBar = document.getElementById('slideshow-progress-bar');

    // ==========================================================================
    // State Variables
    // ==========================================================================
    let activeCategory = 'all';
    let currentLightboxIndex = 0;
    
    // Slideshow states
    let slideshowTimer = null;
    let progress = 0;
    const slideshowDuration = 5000; // 5 seconds per slide
    const tickInterval = 50; // Progress bar updates every 50ms
    const progressStep = 100 / (slideshowDuration / tickInterval);
    let isSlideshowPlaying = false;

    // Mobile Swipe detection states
    let touchStartX = 0;
    let touchEndX = 0;

    // Parse image cards from HTML to maintain a local data source
    const items = Array.from(galleryItems).map((item, index) => {
        const img = item.querySelector('.gallery-img');
        return {
            element: item,
            globalIndex: index,
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            category: item.getAttribute('data-category'),
            title: item.getAttribute('data-title'),
            desc: item.getAttribute('data-desc')
        };
    });

    // Tracks only currently visible items (filtered & searched)
    let visibleItems = [...items];

    // ==========================================================================
    // Theme Management (Dark/Light mode)
    // ==========================================================================
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 
            (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // ==========================================================================
    // Search & Filter Logic
    // ==========================================================================
    function filterGallery() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        visibleItems = [];
        let matchCount = 0;

        items.forEach(item => {
            const categoryMatch = (activeCategory === 'all' || item.category === activeCategory);
            const searchMatch = (item.title.toLowerCase().includes(searchTerm) || 
                                 item.desc.toLowerCase().includes(searchTerm));

            if (categoryMatch && searchMatch) {
                // Item matches filter rules -> display it
                item.element.classList.remove('hide');
                item.element.classList.add('show');
                
                // Reset animation delays for newly visible items to prevent weird stuttering
                item.element.style.animationDelay = `${matchCount * 0.05}s`;
                
                visibleItems.push(item);
                matchCount++;
            } else {
                // Item does not match -> hide it
                item.element.classList.remove('show');
                item.element.classList.add('hide');
            }
        });

        // Toggle clear search button visibility
        clearSearchBtn.style.display = searchTerm ? 'flex' : 'none';

        // Update accessibility/visual status indicator
        updateStatusMessage(matchCount);
    }

    function updateStatusMessage(count) {
        if (count === 0) {
            statusIndicator.textContent = "No images found matching your search.";
        } else if (count === items.length) {
            statusIndicator.textContent = "Showing all items";
        } else {
            statusIndicator.textContent = `Showing ${count} of ${items.length} items`;
        }
    }

    // Bind Category Filter Buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active styling
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update category state
            activeCategory = btn.getAttribute('data-filter');
            filterGallery();
        });
    });

    // Bind Search Input Events
    searchInput.addEventListener('input', filterGallery);

    // Clear Search Input
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
        filterGallery();
    });

    // ==========================================================================
    // Lightbox Controls
    // ==========================================================================
    function openLightbox(itemElement) {
        // Find visible item matches by comparing elements
        const selectedIndex = visibleItems.findIndex(item => item.element === itemElement);
        if (selectedIndex === -1) return;

        currentLightboxIndex = selectedIndex;
        
        // Show lightbox and lock background scroll
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        lightbox.focus();

        updateLightboxImage();
        createLightboxThumbnails();
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        stopSlideshow();
    }

    function showNextImage() {
        if (visibleItems.length === 0) return;
        currentLightboxIndex = (currentLightboxIndex + 1) % visibleItems.length;
        updateLightboxImage();
        resetSlideshowTimer();
    }

    function showPrevImage() {
        if (visibleItems.length === 0) return;
        currentLightboxIndex = (currentLightboxIndex - 1 + visibleItems.length) % visibleItems.length;
        updateLightboxImage();
        resetSlideshowTimer();
    }

    function updateLightboxImage() {
        const item = visibleItems[currentLightboxIndex];
        if (!item) return;

        // Visual transition: fade out slightly first
        lightboxImg.classList.remove('active');

        setTimeout(() => {
            lightboxImg.src = item.src;
            lightboxImg.alt = item.alt;
            lightboxTitle.textContent = item.title;
            lightboxDesc.textContent = item.desc;
            lightboxCategory.textContent = item.category;
            lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${visibleItems.length}`;

            // Trigger fade in animation
            lightboxImg.classList.add('active');

            // Update highlighted thumbnail
            updateActiveThumbnail();
        }, 150); // Small timeout for transition
    }

    // Create bottom thumbnails list dynamically based on visible gallery subset
    function createLightboxThumbnails() {
        lightboxThumbnails.innerHTML = '';
        
        visibleItems.forEach((item, index) => {
            const thumb = document.createElement('img');
            thumb.src = item.src;
            thumb.alt = `Jump to ${item.title}`;
            thumb.classList.add('lightbox-thumb');
            
            if (index === currentLightboxIndex) {
                thumb.classList.add('active');
            }

            thumb.addEventListener('click', () => {
                currentLightboxIndex = index;
                updateLightboxImage();
                resetSlideshowTimer();
            });

            lightboxThumbnails.appendChild(thumb);
        });
        
        // Ensure starting thumbnail is centered in the viewport
        setTimeout(updateActiveThumbnail, 200);
    }

    function updateActiveThumbnail() {
        const thumbs = lightboxThumbnails.querySelectorAll('.lightbox-thumb');
        thumbs.forEach((thumb, index) => {
            if (index === currentLightboxIndex) {
                thumb.classList.add('active');
                
                // Center thumbnail inside scrollable strip
                thumb.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            } else {
                thumb.classList.remove('active');
            }
        });
    }

    // Event Delegation: Clicking on gallery grid opens corresponding item
    galleryGrid.addEventListener('click', (e) => {
        const clickedItem = e.target.closest('.gallery-item');
        if (clickedItem) {
            openLightbox(clickedItem);
        }
    });

    // Focus Keyboard click trigger
    galleryGrid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const focusedItem = e.target.closest('.gallery-item');
            if (focusedItem) {
                openLightbox(focusedItem);
            }
        }
    });

    // Close & Nav event listeners
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxOverlay.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', showPrevImage);
    lightboxNext.addEventListener('click', showNextImage);

    // ==========================================================================
    // Slideshow System
    // ==========================================================================
    function startSlideshow() {
        if (visibleItems.length <= 1) return; // No point in slideshow if only 1 image

        isSlideshowPlaying = true;
        playPauseBtn.querySelector('.play-icon').classList.add('hidden');
        playPauseBtn.querySelector('.pause-icon').classList.remove('hidden');
        playPauseBtn.setAttribute('aria-label', 'Pause Slideshow');
        
        progress = 0;
        progressBar.style.width = '0%';

        slideshowTimer = setInterval(() => {
            progress += progressStep;
            if (progress >= 100) {
                progress = 0;
                progressBar.style.width = '0%';
                showNextImage();
            } else {
                progressBar.style.width = `${progress}%`;
            }
        }, tickInterval);
    }

    function stopSlideshow() {
        isSlideshowPlaying = false;
        if (slideshowTimer) {
            clearInterval(slideshowTimer);
            slideshowTimer = null;
        }
        
        playPauseBtn.querySelector('.play-icon').classList.remove('hidden');
        playPauseBtn.querySelector('.pause-icon').classList.add('hidden');
        playPauseBtn.setAttribute('aria-label', 'Play Slideshow');
        progressBar.style.width = '0%';
    }

    function toggleSlideshow() {
        if (isSlideshowPlaying) {
            stopSlideshow();
        } else {
            startSlideshow();
        }
    }

    function resetSlideshowTimer() {
        if (isSlideshowPlaying) {
            stopSlideshow();
            startSlideshow();
        }
    }

    playPauseBtn.addEventListener('click', toggleSlideshow);

    // ==========================================================================
    // Mobile Touch Navigation (Swipe gestures)
    // ==========================================================================
    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    }, { passive: true });

    function handleSwipeGesture() {
        const swipeThreshold = 50; // pixels to trigger swipe action
        const diffX = touchEndX - touchStartX;

        if (Math.abs(diffX) > swipeThreshold) {
            if (diffX < 0) {
                // Swiped Left -> Next Image
                showNextImage();
            } else {
                // Swiped Right -> Previous Image
                showPrevImage();
            }
        }
    }

    // ==========================================================================
    // Accessibility Keyboard Controls
    // ==========================================================================
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;

        switch(e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowRight':
                showNextImage();
                break;
            case 'ArrowLeft':
                showPrevImage();
                break;
            case ' ':
                // Prevent spacebar scrolling page down inside modal context
                e.preventDefault();
                toggleSlideshow();
                break;
        }
    });

    // ==========================================================================
    // Application Initialization
    // ==========================================================================
    initTheme();
    
    // Apply lazy loading dynamically to ensure smooth initial page entrance transitions
    const lazyImages = document.querySelectorAll('.gallery-img');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    // Lazy-loading can be monitored here if needed
                    observer.unobserve(img);
                }
            });
        });
        lazyImages.forEach(img => observer.observe(img));
    }
});