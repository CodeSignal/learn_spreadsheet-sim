// Configuration Editor Application
let config = {
  spreadsheetURL: '',
  cellsToVerify: []
};

// Escape HTML to prevent XSS attacks
function escapeHtml(text) {
  if (text == null) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  return String(text).replace(/[&<>"'/]/g, s => map[s]);
}

// Load configuration on startup
async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.statusText}`);
    }
    config = await response.json();
    
    // Ensure each cell has a verificationType
    if (config.cellsToVerify) {
      config.cellsToVerify.forEach(cell => {
        if (!cell.verificationType) {
          // Infer from existing data: if function exists, use function, otherwise value
          cell.verificationType = cell.expectedFunction ? 'function' : 'value';
        }
      });
    }
    
    render();
  } catch (error) {
    console.error('Error loading config:', error);
    updateStatus('Error loading configuration', 'error');
  }
}

// Save configuration to server
async function saveConfig() {
  try {
    // Create a cleaned version of config for serialization
    const cleanedConfig = {
      spreadsheetURL: config.spreadsheetURL,
      cellsToVerify: config.cellsToVerify.map(cell => {
        const cleanedCell = {
          cellName: cell.cellName
        };
        
        // Only include expectedValue OR expectedFunction based on verificationType
        const verificationType = cell.verificationType || (cell.expectedFunction ? 'function' : 'value');
        if (verificationType === 'function') {
          cleanedCell.expectedFunction = cell.expectedFunction;
        } else {
          cleanedCell.expectedValue = cell.expectedValue;
        }
        
        return cleanedCell;
      })
    };

    const response = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cleanedConfig)
    });

    if (!response.ok) {
      throw new Error(`Failed to save config: ${response.statusText}`);
    }

    updateStatus('Configuration saved successfully', 'success');
  } catch (error) {
    console.error('Error saving config:', error);
    updateStatus('Error saving configuration', 'error');
  }
}

// Update status message
function updateStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    setTimeout(() => {
      statusEl.textContent = 'Ready';
      statusEl.className = 'status';
    }, 3000);
  }
}

// Handle spreadsheet URL change
function handleSpreadsheetURLChange(event) {
  config.spreadsheetURL = event.target.value;
  render();
  saveConfig();
}

// Handle cell verification change
function handleCellChange(index, field, value) {
  if (!config.cellsToVerify[index]) {
    config.cellsToVerify[index] = {};
  }
  config.cellsToVerify[index][field] = value;
  saveConfig();
}

// Handle verification type change (value/function radio)
function handleVerificationTypeChange(index, type) {
  if (!config.cellsToVerify[index]) {
    config.cellsToVerify[index] = {};
  }
  config.cellsToVerify[index].verificationType = type;
  render();
  saveConfig();
}

// Add new cell verification
function addCellVerification() {
  const newIndex = config.cellsToVerify.length;
  config.cellsToVerify.push({
    cellName: '',
    expectedValue: '',
    expectedFunction: '',
    verificationType: 'value' // 'value' or 'function'
  });
  render();
  
  // Scroll the newly added cell into view, ensuring the "Add Cell" button is also visible
  setTimeout(() => {
    const cellItems = document.querySelectorAll('.cell-item');
    const configEditor = document.querySelector('.config-editor');
    if (cellItems[newIndex] && configEditor) {
      // Scroll the cell into view
      cellItems[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Then scroll a bit more to ensure the "Add Cell" button is visible
      setTimeout(() => {
        const addButton = document.querySelector('.button-primary');
        if (addButton) {
          // Scroll the container a bit more to show the button
          const scrollAmount = addButton.getBoundingClientRect().bottom - configEditor.getBoundingClientRect().bottom + 20;
          if (scrollAmount > 0) {
            configEditor.scrollBy({ top: scrollAmount, behavior: 'smooth' });
          }
        }
      }, 300); // Wait for the first scroll to complete
    }
  }, 0);
  
  saveConfig();
}

// Remove cell verification
function removeCellVerification(index) {
  config.cellsToVerify.splice(index, 1);
  render();
  saveConfig();
}

// Render the configuration editor
function render() {
  const app = document.getElementById('app');
  if (!app) return;

  // Convert Google Sheets URL to embeddable format
  function getEmbedUrl(url) {
    if (!url) return '';
    // Extract spreadsheet ID from URL
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      const spreadsheetId = match[1];
      // Extract gid (sheet ID) if present
      const gidMatch = url.match(/[#&]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '';
      
      // Use edit endpoint which shows headers - clipboard access depends on Google's iframe policies
      let embedUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      const params = [];
      if (gid) {
        params.push(`gid=${gid}`);
      }
      // rm=minimal removes some UI but keeps headers visible
      params.push('rm=minimal');
      if (params.length > 0) {
        embedUrl += '?' + params.join('&');
      }
      return embedUrl;
    }
    return url;
  }

  const spreadsheetUrl = config.spreadsheetURL || '';
  const embedUrl = getEmbedUrl(spreadsheetUrl);
  
  // Check if URL changed - if not, we can preserve the iframe
  const existingIframe = document.getElementById('spreadsheet-iframe');
  const urlChanged = !existingIframe || existingIframe.src !== embedUrl;
  
  // If URL hasn't changed, preserve the iframe by updating only the cells section
  if (!urlChanged && existingIframe && spreadsheetUrl) {
    // Only update the cells list, not the entire app
    const cellsList = document.getElementById('cells-list');
    if (cellsList) {
      cellsList.innerHTML = `
        ${config.cellsToVerify.map((cell, index) => {
          const verificationType = cell.verificationType || (cell.expectedFunction ? 'function' : 'value');
          return `
          <div class="cell-item" style="border: 1px solid var(--Colors-Box-Stroke); border-radius: var(--UI-Radius-radius-s); padding: var(--UI-Spacing-spacing-l); margin-bottom: var(--UI-Spacing-spacing-m); background: var(--Colors-Box-Background);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--UI-Spacing-spacing-m);">
              <div style="display: flex; align-items: center; gap: var(--UI-Spacing-spacing-l);">
                <label class="input-radio input-radio-small" style="margin: 0;">
                  <input 
                    type="radio" 
                    name="verification-type-${index}" 
                    value="value"
                    ${verificationType === 'value' ? 'checked' : ''}
                    onchange="handleVerificationTypeChange(${index}, 'value')"
                  />
                  <span class="input-radio-circle">
                    <span class="input-radio-dot"></span>
                  </span>
                  <span class="input-radio-label">Value</span>
                </label>
                
                <label class="input-radio input-radio-small" style="margin: 0;">
                  <input 
                    type="radio" 
                    name="verification-type-${index}" 
                    value="function"
                    ${verificationType === 'function' ? 'checked' : ''}
                    onchange="handleVerificationTypeChange(${index}, 'function')"
                  />
                  <span class="input-radio-circle">
                    <span class="input-radio-dot"></span>
                  </span>
                  <span class="input-radio-label">Function</span>
                </label>
              </div>
              <button class="button button-text" onclick="removeCellVerification(${index})" style="color: var(--Colors-Base-Accent-Red-600);">
                Remove
              </button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--UI-Spacing-spacing-m); margin-bottom: var(--UI-Spacing-spacing-m);">
              <div>
                <label style="display: block; margin-bottom: var(--UI-Spacing-spacing-xs); font-weight: 500; font-size: var(--Fonts-Body-Default-sm); color: var(--Colors-Text-Body-Medium);">
                  Cell Name
                </label>
                <input 
                  type="text" 
                  class="input" 
                  style="width: 100%; box-sizing: border-box;"
                  value="${escapeHtml(cell.cellName || '')}" 
                  placeholder="e.g., A1"
                  onchange="handleCellChange(${index}, 'cellName', event.target.value)"
                />
              </div>
              
              ${verificationType === 'value' ? `
              <div>
                <label style="display: block; margin-bottom: var(--UI-Spacing-spacing-xs); font-weight: 500; font-size: var(--Fonts-Body-Default-sm); color: var(--Colors-Text-Body-Medium);">
                  Expected Value
                </label>
                <input 
                  type="text" 
                  class="input" 
                  style="width: 100%; box-sizing: border-box;"
                  value="${escapeHtml(cell.expectedValue || '')}" 
                  placeholder="e.g., 10"
                  onchange="handleCellChange(${index}, 'expectedValue', event.target.value)"
                />
              </div>
              ` : `
              <div>
                <label style="display: block; margin-bottom: var(--UI-Spacing-spacing-xs); font-weight: 500; font-size: var(--Fonts-Body-Default-sm); color: var(--Colors-Text-Body-Medium);">
                  Expected Function
                </label>
                <input 
                  type="text" 
                  class="input" 
                  style="width: 100%; box-sizing: border-box;"
                  value="${escapeHtml(cell.expectedFunction || '')}" 
                  placeholder="e.g., =SUM(A1:A10)"
                  onchange="handleCellChange(${index}, 'expectedFunction', event.target.value)"
                />
              </div>
              `}
            </div>
          </div>
        `;
        }).join('')}
        
        ${config.cellsToVerify.length === 0 ? `
          <div style="text-align: left; padding: var(--UI-Spacing-spacing-xl); color: var(--Colors-Text-Body-Light);">
            No cells configured. Click "Add Cell" below to get started.
          </div>
        ` : ''}
      `;
      return; // Early return to avoid full re-render
    }
  }

  app.innerHTML = `
    <div style="grid-column: 1 / -1; margin-bottom: var(--UI-Spacing-spacing-xl);">
      <div class="box card">
        <div style="width: 100%;">
          <label for="spreadsheet-url" class="label-medium" style="display: block; margin-bottom: var(--UI-Spacing-spacing-xs); color: var(--Colors-Text-Body-Medium); text-align: left;">
            Spreadsheet URL
          </label>
          <input 
            type="text" 
            id="spreadsheet-url" 
            class="input" 
            style="width: 100%; max-width: 100%; box-sizing: border-box;"
            value="${escapeHtml(spreadsheetUrl)}" 
            placeholder="https://docs.google.com/spreadsheets/d/..."
            onchange="handleSpreadsheetURLChange(event)"
          />
        </div>
      </div>
    </div>

    <div class="config-editor">
      <h2 class="heading-medium" style="margin-top: 0; margin-bottom: var(--UI-Spacing-spacing-xl); color: var(--Colors-Text-Body-Strong);">Cells to Verify</h2>

      <div class="box card" style="display: flex; flex-direction: column; align-items: flex-start;">
        <div id="cells-list" style="width: 100%;">
          ${config.cellsToVerify.map((cell, index) => {
            const verificationType = cell.verificationType || (cell.expectedFunction ? 'function' : 'value');
            return `
            <div class="cell-item" style="border: 1px solid var(--Colors-Box-Stroke); border-radius: var(--UI-Radius-radius-s); padding: var(--UI-Spacing-spacing-l); margin-bottom: var(--UI-Spacing-spacing-m); background: var(--Colors-Box-Background);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--UI-Spacing-spacing-m);">
                <div style="display: flex; align-items: center; gap: var(--UI-Spacing-spacing-l);">
                  <label class="input-radio input-radio-small" style="margin: 0;">
                    <input 
                      type="radio" 
                      name="verification-type-${index}" 
                      value="value"
                      ${verificationType === 'value' ? 'checked' : ''}
                      onchange="handleVerificationTypeChange(${index}, 'value')"
                    />
                    <span class="input-radio-circle">
                      <span class="input-radio-dot"></span>
                    </span>
                    <span class="input-radio-label">Value</span>
                  </label>
                  
                  <label class="input-radio input-radio-small" style="margin: 0;">
                    <input 
                      type="radio" 
                      name="verification-type-${index}" 
                      value="function"
                      ${verificationType === 'function' ? 'checked' : ''}
                      onchange="handleVerificationTypeChange(${index}, 'function')"
                    />
                    <span class="input-radio-circle">
                      <span class="input-radio-dot"></span>
                    </span>
                    <span class="input-radio-label">Function</span>
                  </label>
                </div>
                <button class="button button-text" onclick="removeCellVerification(${index})" style="color: var(--Colors-Base-Accent-Red-600);">
                  Remove
                </button>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--UI-Spacing-spacing-m); margin-bottom: var(--UI-Spacing-spacing-m);">
                <div>
                  <label style="display: block; margin-bottom: var(--UI-Spacing-spacing-xs); font-weight: 500; font-size: var(--Fonts-Body-Default-sm); color: var(--Colors-Text-Body-Medium);">
                    Cell Name
                  </label>
                  <input 
                    type="text" 
                    class="input" 
                    style="width: 100%; box-sizing: border-box;"
                    value="${escapeHtml(cell.cellName || '')}" 
                    placeholder="e.g., A1"
                    onchange="handleCellChange(${index}, 'cellName', event.target.value)"
                  />
                </div>
                
                ${verificationType === 'value' ? `
                <div>
                  <label style="display: block; margin-bottom: var(--UI-Spacing-spacing-xs); font-weight: 500; font-size: var(--Fonts-Body-Default-sm); color: var(--Colors-Text-Body-Medium);">
                    Expected Value
                  </label>
                  <input 
                    type="text" 
                    class="input" 
                    style="width: 100%; box-sizing: border-box;"
                    value="${escapeHtml(cell.expectedValue || '')}" 
                    placeholder="e.g., 10"
                    onchange="handleCellChange(${index}, 'expectedValue', event.target.value)"
                  />
                </div>
                ` : `
                <div>
                  <label style="display: block; margin-bottom: var(--UI-Spacing-spacing-xs); font-weight: 500; font-size: var(--Fonts-Body-Default-sm); color: var(--Colors-Text-Body-Medium);">
                    Expected Function
                  </label>
                  <input 
                    type="text" 
                    class="input" 
                    style="width: 100%; box-sizing: border-box;"
                    value="${escapeHtml(cell.expectedFunction || '')}" 
                    placeholder="e.g., =SUM(A1:A10)"
                    onchange="handleCellChange(${index}, 'expectedFunction', event.target.value)"
                  />
                </div>
                `}
              </div>
            </div>
          `;
          }).join('')}
          
          ${config.cellsToVerify.length === 0 ? `
            <div style="text-align: left; padding: var(--UI-Spacing-spacing-xl); color: var(--Colors-Text-Body-Light);">
              No cells configured. Click "Add Cell" below to get started.
            </div>
          ` : ''}
        </div>

        <div style="margin-top: var(--UI-Spacing-spacing-m); width: 100%;">
          <button class="button button-primary" onclick="addCellVerification()">
            Add Cell
          </button>
        </div>
      </div>
    </div>

    <div class="spreadsheet-preview">
      ${spreadsheetUrl ? `
        <iframe 
          id="spreadsheet-iframe"
          src="${escapeHtml(embedUrl)}"
          frameborder="0"
          allowfullscreen
          allow="clipboard-read; clipboard-write"
        ></iframe>
      ` : `
        <div class="spreadsheet-preview-placeholder" style="flex: 1; min-height: 0;">
          <div>
            <p style="font-size: var(--Fonts-Body-Default-md); color: var(--Colors-Text-Body-Light);">
              Enter a spreadsheet URL to see a preview here.
            </p>
          </div>
        </div>
      `}
    </div>
  `;
}

// Make functions globally available for inline handlers
window.handleSpreadsheetURLChange = handleSpreadsheetURLChange;
window.handleCellChange = handleCellChange;
window.handleVerificationTypeChange = handleVerificationTypeChange;
window.addCellVerification = addCellVerification;
window.removeCellVerification = removeCellVerification;

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadConfig);
} else {
  loadConfig();
}
