
const NODE_URL = 'https://tracenet-blockchain-136028201808.us-central1.run.app';

async function checkContent() {
    console.log(`Checking content on ${NODE_URL}...`);
    try {
        const response = await fetch(`${NODE_URL}/api/content/feed?limit=1`);
        const data = await response.json();

        if (data.success) {
            console.log(`\n📊 Total Content Count: ${data.total}`);
            console.log(`   (Latest ID: ${data.contents.length > 0 ? data.contents[0].content_id : 'None'})`);
        } else {
            console.error('Failed:', data.error);
        }
    } catch (e: any) {
        console.error('Network Error:', e.message);
    }
}

checkContent();
