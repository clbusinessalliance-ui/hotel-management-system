const params = new URLSearchParams(window.location.search);
const backendUrl = params.get('backendUrl') || 'http://localhost:3001';

const backendLabel = document.getElementById('backend-url');
const healthNode = document.getElementById('health');

backendLabel.textContent = `Backend URL: ${backendUrl}`;

async function checkBackend() {
  try {
    const response = await fetch(`${backendUrl}/api/health`);
    const data = await response.json();

    healthNode.className = 'status ok';
    healthNode.innerHTML = `Backend connected ✅ <br /><code>${JSON.stringify(data)}</code>`;
  } catch (error) {
    healthNode.className = 'status error';
    healthNode.textContent = `Backend connection failed: ${error.message}`;
  }
}

checkBackend();
