// Documentation JavaScript
document.addEventListener('DOMContentLoaded', () => {
    initializeTOC();
    handleScrollSpy();
    initTheme();
});

// Theme Management - sync with main app
function initTheme() {
    const savedMode = localStorage.getItem('themeMode') || 'light';
    const savedColor = localStorage.getItem('themeColor') || 'default';
    applyTheme(savedMode, savedColor);
}

function applyTheme(mode, color) {
    let effectiveMode = mode;
    
    // Determine effective mode (auto resolves to light or dark)
    if (mode === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveMode = prefersDark ? 'dark' : 'light';
    }
    
    // Apply theme based on mode and color
    let themeValue;
    if (color === 'default') {
        themeValue = effectiveMode; // 'light' or 'dark'
    } else {
        themeValue = `${color}-${effectiveMode}`;
    }
    
    document.documentElement.setAttribute('data-theme', themeValue);
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const savedMode = localStorage.getItem('themeMode');
    const savedColor = localStorage.getItem('themeColor') || 'default';
    if (savedMode === 'auto') {
        applyTheme('auto', savedColor);
    }
});

function initializeTOC() {
    const tocLinks = document.querySelectorAll('.toc-link');
    
    tocLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Remove active class from all links
            tocLinks.forEach(l => l.classList.remove('active'));
            // Add active class to clicked link
            this.classList.add('active');
        });
    });
}

function handleScrollSpy() {
    const sections = document.querySelectorAll('.doc-section, .feature-block, .step-block, .usage-block');
    const tocLinks = document.querySelectorAll('.toc-link');
    
    // Create an intersection observer
    const observerOptions = {
        root: null,
        rootMargin: '-120px 0px -60% 0px',
        threshold: 0
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                if (id) {
                    // Remove active class from all links
                    tocLinks.forEach(link => link.classList.remove('active'));
                    
                    // Add active class to corresponding link
                    const activeLink = document.querySelector(`.toc-link[href="#${id}"]`);
                    if (activeLink) {
                        activeLink.classList.add('active');
                        
                        // Scroll the TOC to make the active link visible
                        const toc = document.querySelector('.doc-toc');
                        const linkTop = activeLink.offsetTop;
                        const tocHeight = toc.clientHeight;
                        const linkHeight = activeLink.clientHeight;
                        
                        if (linkTop < toc.scrollTop || linkTop + linkHeight > toc.scrollTop + tocHeight) {
                            toc.scrollTo({
                                top: linkTop - tocHeight / 2 + linkHeight / 2,
                                behavior: 'smooth'
                            });
                        }
                    }
                }
            }
        });
    }, observerOptions);
    
    // Observe all sections
    sections.forEach(section => {
        if (section.id) {
            observer.observe(section);
        }
    });
}

// Smooth scroll with offset for fixed header
document.querySelectorAll('.toc-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
            const headerOffset = 120;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});
