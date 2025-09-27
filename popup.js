// Popup script for Search Results Enhancer

document.addEventListener('DOMContentLoaded', async function() {
    // DOM elements
    const extensionStatus = document.getElementById('extensionStatus');
    const lastEnhancement = document.getElementById('lastEnhancement');
    const resultsCount = document.getElementById('resultsCount');
    const targetResults = document.getElementById('targetResults');
    const enableExtension = document.getElementById('enableExtension');
    const enhanceNowBtn = document.getElementById('enhanceNow');
    const saveSettingsBtn = document.getElementById('saveSettings');

    // Load saved settings
    try {
        const result = await chrome.storage.local.get(['settings', 'lastEnhancement']);
        
        // Load settings
        if (result.settings) {
            targetResults.value = result.settings.targetResults || 50;
            enableExtension.checked = result.settings.enabled !== false;
        }

        // Load last enhancement data
        if (result.lastEnhancement) {
            const enhancement = result.lastEnhancement;
            const date = new Date(enhancement.timestamp);
            lastEnhancement.textContent = date.toLocaleString();
            resultsCount.textContent = enhancement.resultCount;
            extensionStatus.textContent = 'Active';
            extensionStatus.className = 'status-value success';
        } else {
            extensionStatus.textContent = 'Ready';
            extensionStatus.className = 'status-value info';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        extensionStatus.textContent = 'Error';
        extensionStatus.className = 'status-value warning';
    }

    // Save settings
    saveSettingsBtn.addEventListener('click', async function() {
        try {
            const settings = {
                targetResults: parseInt(targetResults.value),
                enabled: enableExtension.checked
            };

            await chrome.storage.local.set({ settings });
            
            // Update button text temporarily
            const originalText = saveSettingsBtn.textContent;
            saveSettingsBtn.textContent = 'Saved!';
            saveSettingsBtn.disabled = true;
            
            setTimeout(() => {
                saveSettingsBtn.textContent = originalText;
                saveSettingsBtn.disabled = false;
            }, 1500);

        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings. Please try again.');
        }
    });

    // Enhance current page
    enhanceNowBtn.addEventListener('click', async function() {
        try {
            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                alert('No active tab found.');
                return;
            }

            // Check if it's a search page
            const url = tab.url.toLowerCase();
            const isSearchPage = url.includes('google.com/search') || 
                                url.includes('bing.com/search') || 
                                url.includes('duckduckgo.com');

            if (!isSearchPage) {
                alert('Please navigate to a search results page first.');
                return;
            }

            // Update button state
            const originalText = enhanceNowBtn.textContent;
            enhanceNowBtn.textContent = 'Enhancing...';
            enhanceNowBtn.disabled = true;

            // Inject and execute the content script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            // Reset button after delay
            setTimeout(() => {
                enhanceNowBtn.textContent = originalText;
                enhanceNowBtn.disabled = false;
            }, 3000);

        } catch (error) {
            console.error('Error enhancing page:', error);
            alert('Error enhancing page. Please make sure you are on a supported search engine.');
            
            enhanceNowBtn.textContent = 'Enhance Current Page';
            enhanceNowBtn.disabled = false;
        }
    });

    // Real-time settings validation
    targetResults.addEventListener('input', function() {
        const value = parseInt(this.value);
        if (value < 10) {
            this.value = 10;
        } else if (value > 100) {
            this.value = 100;
        }
    });

    // Listen for storage changes to update UI
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local' && changes.lastEnhancement) {
            const enhancement = changes.lastEnhancement.newValue;
            if (enhancement) {
                const date = new Date(enhancement.timestamp);
                lastEnhancement.textContent = date.toLocaleString();
                resultsCount.textContent = enhancement.resultCount;
                extensionStatus.textContent = 'Active';
                extensionStatus.className = 'status-value success';
            }
        }
    });

    // Check current tab status
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            const url = tab.url.toLowerCase();
            const isSearchPage = url.includes('google.com/search') || 
                                url.includes('bing.com/search') || 
                                url.includes('duckduckgo.com');
            
            if (isSearchPage) {
                enhanceNowBtn.style.background = '#137333';
                enhanceNowBtn.textContent = 'Enhance This Page';
            } else {
                enhanceNowBtn.style.background = '#dadce0';
                enhanceNowBtn.style.color = '#5f6368';
                enhanceNowBtn.textContent = 'Go to Search Page';
            }
        }
    } catch (error) {
        console.error('Error checking tab status:', error);
    }
});
