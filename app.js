/**
 * app.js - Dashboard Logic
 */

const historyList = document.getElementById('history-list');
const detailView = document.getElementById('detail-view');
const emptyState = document.getElementById('empty-state');
const resultsGrid = document.getElementById('results-grid');
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('site-search');
const failOnlyCheckbox = document.getElementById('fail-only');

const modal = document.getElementById('screenshot-modal');
const modalImg = document.getElementById('modal-img');
const closeModal = document.querySelector('.close-modal');

let currentRunData = null;

/**
 * Initialize the app
 */
async function init() {
    await loadHistory();
    
    refreshBtn.addEventListener('click', loadHistory);
    searchInput.addEventListener('input', renderResults);
    failOnlyCheckbox.addEventListener('change', renderResults);
    
    closeModal.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
    };
}

/**
 * Load execution history from index.json
 */
async function loadHistory() {
    try {
        historyList.innerHTML = '<div class="loading-spinner">로딩 중...</div>';
        const response = await fetch('reports/index.json?t=' + Date.now());
        const history = await response.json();
        
        if (history.length === 0) {
            historyList.innerHTML = '<div class="empty-msg">실행 이력이 없습니다.</div>';
            return;
        }

        historyList.innerHTML = '';
        history.forEach(run => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="run-id">${run.runId}</div>
                <div class="run-meta">
                    <span>${new Date(run.timestamp).toLocaleString()}</span>
                    <span class="${run.summary.fail > 0 ? 'text-danger' : 'text-success'}">
                        ${run.summary.success}/${run.summary.total}
                    </span>
                </div>
            `;
            item.onclick = () => loadRunDetail(run.runId, item);
            historyList.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to load history:', error);
        historyList.innerHTML = '<div class="error-msg">데이터를 불러오지 못했습니다.</div>';
    }
}

/**
 * Load specific run details
 */
async function loadRunDetail(runId, element) {
    // UI Update
    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    
    try {
        const response = await fetch(`reports/${runId}.json`);
        currentRunData = await response.json();
        
        detailView.classList.remove('hidden');
        emptyState.classList.add('hidden');
        
        document.getElementById('detail-run-id').textContent = runId;
        document.getElementById('detail-timestamp').textContent = new Date(currentRunData.timestamp).toLocaleString();
        document.getElementById('summary-total').textContent = currentRunData.summary.total;
        document.getElementById('summary-success').textContent = currentRunData.summary.success;
        document.getElementById('summary-fail').textContent = currentRunData.summary.fail;
        
        renderResults();
    } catch (error) {
        console.error('Failed to load run detail:', error);
        alert('상세 데이터를 불러오지 못했습니다.');
    }
}

/**
 * Render filtered results grid
 */
function renderResults() {
    if (!currentRunData) return;

    const searchTerm = searchInput.value.toLowerCase();
    const failOnly = failOnlyCheckbox.checked;

    const filteredItems = currentRunData.items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm) || item.url.toLowerCase().includes(searchTerm);
        const matchesFail = !failOnly || item.status === 'FAIL';
        return matchesSearch && matchesFail;
    });

    resultsGrid.innerHTML = '';
    
    if (filteredItems.length === 0) {
        resultsGrid.innerHTML = '<div class="empty-state">검색 결과가 없습니다.</div>';
        return;
    }

    filteredItems.forEach(item => {
        const card = document.createElement('div');
        card.className = `result-item ${item.status === 'FAIL' ? 'fail' : ''}`;
        
        const screenshotHtml = item.screenshot 
            ? `<img src="${item.screenshot}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/300x180?text=No+Image'">`
            : `<div class="no-image">No Screenshot</div>`;

        card.innerHTML = `
            <div class="screenshot-container" onclick="openScreenshot('${item.screenshot}', '${item.name}')">
                ${screenshotHtml}
                <span class="status-badge ${item.status.toLowerCase()}">${item.status}</span>
            </div>
            <div class="result-info">
                <h3>${item.name}</h3>
                <a href="${item.url}" target="_blank" class="url">${item.url}</a>
                ${item.error ? `<div class="error-msg">${item.error}</div>` : ''}
            </div>
        `;
        resultsGrid.appendChild(card);
    });
}

/**
 * Open screenshot in modal
 */
function openScreenshot(src, name) {
    if (!src) return;
    modal.style.display = "block";
    modalImg.src = src;
    document.getElementById('modal-caption').textContent = name;
}

init();
