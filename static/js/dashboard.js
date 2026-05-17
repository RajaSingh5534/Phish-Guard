// Initialize dashboard data from localStorage
function initializeDashboard() {
    const scanHistory = JSON.parse(localStorage.getItem('scanHistory') || '[]');
    
    // Calculate stats - count based on status
    let safeCounts = scanHistory.filter(item => {
        return item.status === 'safe';
    }).length;
    let unsafeCounts = scanHistory.filter(item => {
        return item.status === 'dangerous' || item.status === 'suspicious';
    }).length;
    
    document.getElementById('total-scans').textContent = scanHistory.length;
    document.getElementById('safe-urls').textContent = safeCounts;
    document.getElementById('unsafe-urls').textContent = unsafeCounts;
    
    // Display history in reverse order (newest first)
    const historyContainer = document.getElementById('scan-history');
    if (scanHistory.length > 0) {
        historyContainer.innerHTML = [...scanHistory].reverse().map(item => {
            const displayStatus = item.status === 'dangerous' ? 'dangerous' : item.status;
            const riskScore = item.riskScore !== undefined ? item.riskScore : 0;
            const riskPercent = Math.round(riskScore * 100);
            console.log('Rendering history item:', {url: item.url, riskScore, riskPercent, type: typeof riskScore});
            const riskClass = riskPercent < 30 ? 'safe' : riskPercent < 60 ? 'warn' : 'danger';
            const riskColor = riskClass === 'safe' ? '#22c55e' : riskClass === 'warn' ? '#f59e0b' : '#ef4444';
            return `
                <div class="history-item ${displayStatus}">
                    <div>
                        <div><strong>${item.url}</strong></div>
                        <small>${new Date(item.timestamp).toLocaleString()}</small>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 16px; font-weight: 900; color: ${riskColor};">${riskPercent}%</span>
                        <span class="status-badge ${displayStatus}">
                            ${displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Dashboard URL check functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    
    const checkButton = document.getElementById('dashboardCheckButton');
    const urlInput = document.getElementById('dashboardUrlInput');
    
    if (checkButton) {
        checkButton.addEventListener('click', checkDashboardURL);
    }
    
    if (urlInput) {
        urlInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                checkDashboardURL();
            }
        });
    }
    
    // Listen for storage changes (from other tabs/windows) to auto-refresh dashboard
    window.addEventListener('storage', function(e) {
        if (e.key === 'scanHistory') {
            console.log('Storage changed, refreshing dashboard...');
            initializeDashboard();
        }
    });
    
    // Refresh dashboard every 2 seconds to catch updates from index page
    setInterval(function() {
        const firstRender = sessionStorage.getItem('dashboardFirstRender');
        if (!firstRender) {
            sessionStorage.setItem('dashboardFirstRender', 'true');
        } else {
            // Auto-refresh after first render
            initializeDashboard();
        }
    }, 2000);
});

function checkDashboardURL() {
    const url = document.getElementById('dashboardUrlInput').value.trim();
    const resultDiv = document.getElementById('dashboardResult');
    
    if (!url) {
        alert('Please enter a URL');
        return;
    }
    
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="alert alert-info"><i class="fas fa-spinner fa-spin"></i> Analyzing URL...</div>';
    
    fetch('/check_url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: url })
    })
    .then(response => response.json())
    .then(data => {
        const details = data.details || {};
        console.log('Dashboard scan response:', data);
        console.log('Details object:', details);
        console.log('Risk score from dashboard response:', details.risk_score, 'type:', typeof details.risk_score);
        
        const analysisStatus = details.analysis_status || 'unrecognized';
        const displayUrl = details.url || url;
        const riskScore = details.risk_score ?? 0;
        console.log('Extracted dashboard riskScore:', riskScore, 'type:', typeof riskScore);
        const hasSsl = details.has_ssl || false;
        const domainAge = details.domain_age || 'Unknown';
        const riskFactors = details.risk_factors || [];
        const detectionMethods = details.detection_methods || [];
        
        const statusConfig = {
            safe: { icon: 'fas fa-check-circle', text: 'Safe', badge: 'safe' },
            suspicious: { icon: 'fas fa-exclamation-circle', text: 'Suspicious', badge: 'suspicious' },
            dangerous: { icon: 'fas fa-times-circle', text: 'Dangerous', badge: 'unsafe' },
            unrecognized: { icon: 'fas fa-question-circle', text: 'Unrecognized', badge: 'suspicious' }
        };
        
        const config = statusConfig[analysisStatus] || statusConfig.unrecognized;
        
        let resultHTML = `
            <div class="result-card ${config.badge}">
                <h5>
                    <i class="${config.icon}"></i>
                    ${config.text}
                </h5>
                <p><strong>URL:</strong> ${displayUrl}</p>
                <p><strong>Risk Score:</strong> ${(riskScore * 100).toFixed(1)}%</p>
                <p><strong>Domain Age:</strong> ${domainAge}</p>
                <p><strong>SSL Certificate:</strong> ${hasSsl ? '✓ Present' : '✗ Missing'}</p>`;
        
        if (detectionMethods.length > 0) {
            resultHTML += `<p><strong>Detection Methods:</strong> ${detectionMethods.join(', ')}</p>`;
        }
        
        if (riskFactors.length > 0) {
            resultHTML += `
                <div style="margin-top: 16px;">
                    <strong>Risk Factors:</strong>
                    <ul style="margin: 8px 0 0 20px;">
                        ${riskFactors.map(factor => '<li style="font-size: 13px; margin: 6px 0;">' + factor + '</li>').join('')}
                    </ul>
                </div>`;
        }
        
        resultHTML += '</div>';
        resultDiv.innerHTML = resultHTML;
        
        // Save to shared localStorage
        const scanHistory = JSON.parse(localStorage.getItem('scanHistory') || '[]');
        console.log('Dashboard scan - saving riskScore:', riskScore, '(type:', typeof riskScore, ')');
        scanHistory.push({
            url: displayUrl,
            status: analysisStatus,
            riskScore: riskScore,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('scanHistory', JSON.stringify(scanHistory));
        console.log('Saved to localStorage from dashboard:', scanHistory[scanHistory.length - 1]);
        
        // Clear input and refresh dashboard
        document.getElementById('dashboardUrlInput').value = '';
        initializeDashboard();
    })
    .catch(error => {
        resultDiv.innerHTML = '<div class="alert alert-info"><i class="fas fa-exclamation-circle"></i> An error occurred while analyzing the URL</div>';
        console.error('Error:', error);
    });
}
