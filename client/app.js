// Configuration Editor Application
let config = {
  spreadsheetURL: '',
  cellsToVerify: []
};

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
  config.cellsToVerify.push({
    cellName: '',
    expectedValue: '',
    expectedFunction: '',
    verificationType: 'value' // 'value' or 'function'
  });
  render();
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

  app.innerHTML = `
    <div class="config-editor">
      <div class="box box-elevated" style="margin-bottom: var(--UI-Spacing-spacing-xl);">
        <div style="width: 100%;">
          <label for="spreadsheet-url" class="label-medium" style="display: block; margin-bottom: var(--UI-Spacing-spacing-xs); color: var(--Colors-Text-Body-Medium); text-align: left;">
            Spreadsheet URL
          </label>
          <input 
            type="text" 
            id="spreadsheet-url" 
            class="input" 
            style="width: 100%; max-width: 100%; box-sizing: border-box;"
            value="${config.spreadsheetURL || ''}" 
            placeholder="https://docs.google.com/spreadsheets/d/..."
            onchange="handleSpreadsheetURLChange(event)"
          />
        </div>
      </div>

      <div class="box box-elevated" style="display: flex; flex-direction: column; align-items: flex-start;">
        <h2 class="heading-medium" style="margin-top: 0; margin-bottom: var(--UI-Spacing-spacing-xl); color: var(--Colors-Text-Body-Strong); width: 100%;">Cells to Verify</h2>

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
                    value="${cell.cellName || ''}" 
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
                    value="${cell.expectedValue || ''}" 
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
                    value="${cell.expectedFunction || ''}" 
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
