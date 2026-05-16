async function performSearch() {
  const query = document.getElementById('queryInput').value.trim();
  
  if (!query) {
    showError('Please enter a search query');
    return;
  }

  showLoading(true);
  hideError();
  hideResults();

  try {
    const result = await window.api.searchLinks(query);
    
    if (result.success) {
      displayResults(result.data);
    } else {
      showError(result.error || 'An error occurred while searching');
    }
  } catch (error) {
    showError(`Error: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

function displayResults(data) {
  const resultsDiv = document.getElementById('results');
  const resultsContent = document.getElementById('resultsContent');
  
  let html = '<h2>Search Results</h2>';
  
  // Show interpretation from AI
  if (data.interpretation) {
    html += `<div class="interpretation">
      <strong>AI Understood:</strong> ${data.interpretation}
    </div>`;
  }
  
  // Show sort method
  const sortMethodText = {
    'price': '💰 Sorted by Price (Cheapest First)',
    'quality': '⭐ Sorted by Quality (Best Rated First)',
    'balance': '⚖️ Sorted by Best Value (Price + Quality)'
  };
  html += `<div class="sort-info">
    <strong>Sorting Method:</strong> ${sortMethodText[data.sortPriority] || 'Best Value'}
  </div>`;
  
  // Show best deal if available
  if (data.bestDeal) {
    html += `<div class="best-deal">
      <h3>🏆 Best Deal Found!</h3>
      <p><strong>Product:</strong> ${data.bestDeal.product}</p>
      <p><strong>Price:</strong> ${data.bestDeal.price}</p>
      <p><strong>Delivery:</strong> ${data.bestDeal.delivery}</p>
      <p><strong>Rating:</strong> ${data.bestDeal.rating}/5 ⭐ (${data.bestDeal.reviews} reviews)</p>
      <p><strong>Why Best:</strong> ${data.bestDeal.recommendation || 'Excellent value for money'}</p>
      <button class="best-deal-button" onclick="openLink('${data.bestDeal.url}')">
        Go to Best Deal →
      </button>
    </div>`;
  }
  
  // Show all links ranked
  if (data.links && data.links.length > 0) {
    html += '<h3>All Results (Ranked)</h3>';
    data.links.forEach((link, index) => {
      const badge = index === 0 ? '<span class="rank-badge">🥇 #1</span>' : 
                     index === 1 ? '<span class="rank-badge">🥈 #2</span>' :
                     index === 2 ? '<span class="rank-badge">🥉 #3</span>' :
                     `<span class="rank-badge">#${index + 1}</span>`;
      
      html += `
        <div class="result-item">
          ${badge}
          <div class="result-title">${link.title}</div>
          <a href="${link.url}" class="result-link" target="_blank">${link.url}</a>
          <div class="result-description">${link.description}</div>
          <div class="result-meta">
            <span>💰 ${link.price}</span>
            <span>⭐ ${link.rating}/5 (${link.reviews} reviews)</span>
            <span>📦 ${link.source}</span>
            <span>🚚 ${link.delivery}</span>
          </div>
        </div>
      `;
    });
  } else {
    html += '<p>No results found. Please try a different search.</p>';
  }
  
  resultsContent.innerHTML = html;
  resultsDiv.classList.remove('hidden');
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  if (show) {
    loading.classList.remove('hidden');
  } else {
    loading.classList.add('hidden');
  }
}

function showError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error').classList.add('hidden');
}

function hideResults() {
  document.getElementById('results').classList.add('hidden');
}

function openLink(url) {
  window.open(url, '_blank');
}
