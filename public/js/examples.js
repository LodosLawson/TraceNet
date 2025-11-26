// Examples page functionality

function showCategory(category) {
    // Hide all content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Remove active from all tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected content
    const selectedContent = document.getElementById(category);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }

    // Activate clicked tab
    event.target.classList.add('active');
}

function showCode(tab, codeId) {
    // Get parent example block
    const exampleBlock = tab.closest('.example-block');
    if (!exampleBlock) return;

    // Hide all code blocks in this example
    exampleBlock.querySelectorAll('.code-block').forEach(block => {
        block.style.display = 'none';
    });

    // Remove active from code tabs
    exampleBlock.querySelectorAll('.code-tab').forEach(t => {
        t.classList.remove('active');
    });

    // Show selected code block
    const codeBlock = document.getElementById(codeId);
    if (codeBlock) {
        codeBlock.style.display = 'block';
    }

    // Activate clicked tab
    tab.classList.add('active');
}

function copyCode(button) {
    const codeBlock = button.nextElementSibling;
    if (!codeBlock) return;

    const code = codeBlock.textContent;

    navigator.clipboard.writeText(code).then(() => {
        const originalText = button.textContent;
        button.textContent = '✅ Kopyalandı!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Kopyalama hatası:', err);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Show first tab by default
    const firstTab = document.querySelector('.tab-content');
    if (firstTab) {
        firstTab.classList.add('active');
    }
});
