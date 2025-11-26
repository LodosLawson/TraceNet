// Navigation component - shared across all pages

function createNavigation(activePage) {
    return `
        <div class="nav-buttons">
            <a href="/" class="nav-btn ${activePage === 'home' ? 'active' : ''}">🏠 Ana Sayfa</a>
            <a href="/explorer" class="nav-btn ${activePage === 'explorer' ? 'active' : ''}">⛓️ Explorer</a>
            <a href="/examples" class="nav-btn secondary ${activePage === 'examples' ? 'active' : ''}">💻 API Örnekleri</a>
        </div>
    `;
}

// Initialize navigation on page load
document.addEventListener('DOMContentLoaded', () => {
    const navContainer = document.getElementById('navigation-container');
    if (navContainer) {
        const activePage = navContainer.dataset.page || 'home';
        navContainer.innerHTML = createNavigation(activePage);
    }
});
