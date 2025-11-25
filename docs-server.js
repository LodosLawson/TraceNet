const express = require('express');
const path = require('path');
const app = express();

// Serve static files from public directory
app.use(express.static('public'));

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Documentation server running on port ${PORT}`);
});
