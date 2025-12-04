(function() {
  const template = document.createElement('template');
  template.innerHTML = `
    <style>
      :host {
        display: block;
        font-family: '72', Arial, sans-serif;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        overflow: hidden;
      }
      
      .container {
        padding: 20px;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      .header {
        margin-bottom: 20px;
        border-bottom: 2px solid #0070f2;
        padding-bottom: 10px;
      }
      
      .title {
        font-size: 18px;
        font-weight: bold;
        color: #0070f2;
        margin: 0;
      }
      
      .subtitle {
        font-size: 12px;
        color: #666;
        margin: 5px 0 0 0;
      }
      
      .input-section {
        margin-bottom: 20px;
      }
      
      .label {
        display: block;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #333;
      }
      
      .input-wrapper {
        display: flex;
        gap: 10px;
      }
      
      #queryInput {
        flex: 1;
        padding: 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        transition: border-color 0.2s;
      }
      
      #queryInput:focus {
        outline: none;
        border-color: #0070f2;
        box-shadow: 0 0 0 2px rgba(0, 112, 242, 0.1);
      }
      
      #submitBtn {
        padding: 12px 24px;
        background: #0070f2;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
        white-space: nowrap;
      }
      
      #submitBtn:hover:not(:disabled) {
        background: #005bb5;
      }
      
      #submitBtn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      
      .examples {
        margin-bottom: 20px;
      }
      
      .example-title {
        font-size: 12px;
        font-weight: 600;
        color: #666;
        margin-bottom: 8px;
      }
      
      .example-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      
      .example-chip {
        padding: 6px 12px;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 16px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .example-chip:hover {
        background: #e8f4ff;
        border-color: #0070f2;
        color: #0070f2;
      }
      
      .results {
        flex: 1;
        overflow-y: auto;
        background: #f9f9f9;
        border-radius: 4px;
        padding: 15px;
      }
      
      .message {
        padding: 12px;
        border-radius: 4px;
        margin-bottom: 10px;
        font-size: 13px;
        line-height: 1.5;
      }
      
      .message.info {
        background: #e8f4ff;
        border-left: 4px solid #0070f2;
        color: #003d7a;
      }
      
      .message.success {
        background: #e5f7e5;
        border-left: 4px solid #2eb82e;
        color: #1a5e1a;
      }
      
      .message.error {
        background: #ffe5e5;
        border-left: 4px solid #e60000;
        color: #800000;
      }
      
      .message.loading {
        background: #fff5e5;
        border-left: 4px solid #ff9800;
        color: #8b5200;
      }
      
      .loading-spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid #ff9800;
        border-radius: 50%;
        border-top-color: transparent;
        animation: spin 0.8s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .details {
        margin-top: 10px;
        padding: 10px;
        background: rgba(255,255,255,0.5);
        border-radius: 4px;
        font-size: 12px;
      }
      
      .details-row {
        display: flex;
        justify-content: space-between;
        margin: 4px 0;
      }
      
      .details-label {
        font-weight: 600;
        color: #666;
      }
      
      .details-value {
        color: #333;
      }
      
      .timestamp {
        font-size: 11px;
        color: #999;
        margin-top: 8px;
      }
    </style>
    
    <div class="container">
      <div class="header">
        <h2 class="title">🤖 AI Forecast Agent</h2>
        <p class="subtitle">Ask me to create forecasts in natural language</p>
      </div>
      
      <div class="input-section">
        <label class="label" for="queryInput">Your Request</label>
        <div class="input-wrapper">
          <input 
            type="text" 
            id="queryInput" 
            placeholder="e.g., Create 6 month forecast for GL 500100"
            autocomplete="off"
          />
          <button id="submitBtn">Submit</button>
        </div>
      </div>
      
      <div class="examples">
        <div class="example-title">Try these examples:</div>
        <div class="example-chips">
          <span class="example-chip" data-query="Create 6 month forecast for GL 500100">6 months GL 500100</span>
          <span class="example-chip" data-query="Generate 12 month forecast for account 400250">12 months GL 400250</span>
          <span class="example-chip" data-query="Create forecast for GL 300100 for next year">Next year GL 300100</span>
        </div>
      </div>
      
      <div class="results" id="results">
        <div class="message info">
          <strong>Ready!</strong> Enter your forecast request above or click an example.
        </div>
      </div>
    </div>
  `;

  class AIForecastWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.appendChild(template.content.cloneNode(true));
      
      this._apiEndpoint = '';
      this._apiKey = '';
      this._isProcessing = false;
    }

    connectedCallback() {
      this._apiEndpoint = this.getAttribute('apiEndpoint') || 
        'https://ai-predictive-agent.cfapps.us10.hana.ondemand.com/api/forecast/query';
      this._apiKey = this.getAttribute('apiKey') || '';
      
      const input = this.shadowRoot.getElementById('queryInput');
      const submitBtn = this.shadowRoot.getElementById('submitBtn');
      const exampleChips = this.shadowRoot.querySelectorAll('.example-chip');
      
      // Submit button click
      submitBtn.addEventListener('click', () => this.handleSubmit());
      
      // Enter key in input
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !this._isProcessing) {
          this.handleSubmit();
        }
      });
      
      // Example chips click
      exampleChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const query = chip.getAttribute('data-query');
          input.value = query;
          this.handleSubmit();
        });
      });
    }

    async handleSubmit() {
      const input = this.shadowRoot.getElementById('queryInput');
      const submitBtn = this.shadowRoot.getElementById('submitBtn');
      const results = this.shadowRoot.getElementById('results');
      const query = input.value.trim();
      
      if (!query) {
        this.addMessage('error', 'Please enter a forecast request.');
        return;
      }
      
      if (this._isProcessing) {
        return;
      }
      
      this._isProcessing = true;
      submitBtn.disabled = true;
      
      // Add loading message
      this.addMessage('loading', 'Processing your request...', true);
      
      try {
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (this._apiKey) {
          headers['X-API-Key'] = this._apiKey;
        }
        
        const response = await fetch(this._apiEndpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ 
            query: query,
            sessionId: this.generateSessionId()
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          this.addMessage('success', data.summary || 'Forecast created successfully!', false, data.details);
          
          // Dispatch custom event
          this.dispatchEvent(new CustomEvent('onForecastComplete', {
            detail: data,
            bubbles: true,
            composed: true
          }));
        } else {
          this.addMessage('error', data.error || data.summary || 'Failed to create forecast.');
        }
      } catch (error) {
        console.error('Widget error:', error);
        this.addMessage('error', `Error: ${error.message || 'Network error. Please check your connection.'}`);
      } finally {
        this._isProcessing = false;
        submitBtn.disabled = false;
      }
    }

    addMessage(type, text, isLoading = false, details = null) {
      const results = this.shadowRoot.getElementById('results');
      const messageEl = document.createElement('div');
      messageEl.className = `message ${type}`;
      
      let content = '';
      if (isLoading) {
        content += '<span class="loading-spinner"></span>';
      }
      content += `<div>${text}</div>`;
      
      if (details) {
        content += '<div class="details">';
        if (details.glAccount) {
          content += `<div class="details-row"><span class="details-label">GL Account:</span><span class="details-value">${details.glAccount}</span></div>`;
        }
        if (details.forecastPeriod) {
          content += `<div class="details-row"><span class="details-label">Period:</span><span class="details-value">${details.forecastPeriod} months</span></div>`;
        }
        if (details.versionName) {
          content += `<div class="details-row"><span class="details-label">Version:</span><span class="details-value">${details.versionName}</span></div>`;
        }
        if (details.multiActionStatus) {
          content += `<div class="details-row"><span class="details-label">Status:</span><span class="details-value">${details.multiActionStatus}</span></div>`;
        }
        content += '</div>';
      }
      
      content += `<div class="timestamp">${new Date().toLocaleString()}</div>`;
      
      messageEl.innerHTML = content;
      results.appendChild(messageEl);
      
      // Scroll to bottom
      results.scrollTop = results.scrollHeight;
    }

    generateSessionId() {
      return 'widget_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Property setters for SAC
    set apiEndpoint(value) {
      this._apiEndpoint = value;
    }

    set apiKey(value) {
      this._apiKey = value;
    }

    // Method for SAC
    refresh() {
      const results = this.shadowRoot.getElementById('results');
      results.innerHTML = '<div class="message info"><strong>Ready!</strong> Enter your forecast request above or click an example.</div>';
    }
  }

  customElements.define('com-cvshealth-aiforecast', AIForecastWidget);
})();
