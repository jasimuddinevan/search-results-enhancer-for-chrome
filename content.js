// Search Results Enhancer - Content Script (Revised)
// This script loads 50-100 results on the same page without navigation

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        targetResults: 50, // Target number of results to load
        maxAttempts: 10,   // Maximum attempts to load more results
        delay: 1500,       // Delay between requests (ms)
        debug: true        // Enable debug logging
    };

    // Utility functions
    function log(message, ...args) {
        if (CONFIG.debug) {
            console.log('[Search Enhancer]', message, ...args);
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Detect search engine
    function detectSearchEngine() {
        const hostname = window.location.hostname.toLowerCase();
        if (hostname.includes('google')) return 'google';
        if (hostname.includes('bing')) return 'bing';
        if (hostname.includes('duckduckgo')) return 'duckduckgo';
        return 'unknown';
    }

    // Google-specific functions
    const GoogleHandler = {
        getResultCount() {
            const results = document.querySelectorAll('div[data-ved] h3');
            return results.length;
        },

        getSearchQuery() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('q') || '';
        },

        async fetchMoreResults(startIndex) {
            try {
                const query = this.getSearchQuery();
                const url = new URL(window.location.href);
                url.searchParams.set('start', startIndex.toString());
                url.searchParams.set('num', '10');
                
                log(`Fetching results from index ${startIndex}...`);
                
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Cache-Control': 'no-cache',
                        'User-Agent': navigator.userAgent
                    },
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const html = await response.text();
                return this.parseResultsFromHTML(html);
            } catch (error) {
                log('Error fetching more results:', error);
                return [];
            }
        },

        parseResultsFromHTML(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const results = [];

            // Find result containers
            const resultElements = doc.querySelectorAll('div[data-ved]');
            
            resultElements.forEach(element => {
                const titleElement = element.querySelector('h3');
                const linkElement = element.querySelector('a[href]');
                const snippetElement = element.querySelector('[data-sncf]') || 
                                     element.querySelector('.VwiC3b') ||
                                     element.querySelector('.s3v9rd');

                if (titleElement && linkElement && !element.querySelector('[data-text-ad]')) {
                    results.push({
                        title: titleElement.textContent.trim(),
                        url: linkElement.href,
                        snippet: snippetElement ? snippetElement.textContent.trim() : '',
                        element: element.cloneNode(true)
                    });
                }
            });

            return results;
        },

        insertResults(newResults) {
            const resultsContainer = document.querySelector('#rso') || 
                                   document.querySelector('#search') ||
                                   document.querySelector('.g');

            if (!resultsContainer) {
                log('Could not find results container');
                return false;
            }

            let insertionPoint = resultsContainer;
            if (resultsContainer.id !== 'rso') {
                insertionPoint = resultsContainer.parentElement;
            }

            newResults.forEach(result => {
                // Clean up the cloned element
                const resultElement = result.element;
                
                // Remove any existing event listeners or scripts
                const scripts = resultElement.querySelectorAll('script');
                scripts.forEach(script => script.remove());
                
                // Add a subtle indicator that this is a loaded result
                resultElement.style.borderLeft = '3px solid #4285f4';
                resultElement.style.paddingLeft = '8px';
                resultElement.style.marginBottom = '20px';
                
                insertionPoint.appendChild(resultElement);
            });

            return true;
        },

        async enhanceResults() {
            log('Starting Google results enhancement...');
            const initialCount = this.getResultCount();
            log(`Initial result count: ${initialCount}`);

            let currentCount = initialCount;
            let startIndex = 10; // Google starts pagination at 10
            let attempts = 0;

            while (currentCount < CONFIG.targetResults && attempts < CONFIG.maxAttempts) {
                attempts++;
                log(`Attempt ${attempts}: Loading results from index ${startIndex}`);

                const newResults = await this.fetchMoreResults(startIndex);
                
                if (newResults.length === 0) {
                    log('No more results available');
                    break;
                }

                const inserted = this.insertResults(newResults);
                if (!inserted) {
                    log('Failed to insert results');
                    break;
                }

                currentCount += newResults.length;
                startIndex += 10;
                
                log(`Added ${newResults.length} results. Total: ${currentCount}`);

                if (currentCount >= CONFIG.targetResults) {
                    log(`Target reached: ${currentCount} results`);
                    break;
                }

                await sleep(CONFIG.delay);
            }

            log(`Enhancement complete. Final result count: ${currentCount}`);
            return currentCount;
        }
    };

    // Bing-specific functions
    const BingHandler = {
        getResultCount() {
            const results = document.querySelectorAll('.b_algo');
            return results.length;
        },

        getSearchQuery() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('q') || '';
        },

        async fetchMoreResults(first) {
            try {
                const query = this.getSearchQuery();
                const url = new URL(window.location.href);
                url.searchParams.set('first', first.toString());
                
                log(`Fetching Bing results from index ${first}...`);
                
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'User-Agent': navigator.userAgent
                    },
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const html = await response.text();
                return this.parseResultsFromHTML(html);
            } catch (error) {
                log('Error fetching Bing results:', error);
                return [];
            }
        },

        parseResultsFromHTML(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const results = [];

            const resultElements = doc.querySelectorAll('.b_algo');
            
            resultElements.forEach(element => {
                const titleElement = element.querySelector('h2 a');
                const snippetElement = element.querySelector('.b_caption p');

                if (titleElement) {
                    results.push({
                        title: titleElement.textContent.trim(),
                        url: titleElement.href,
                        snippet: snippetElement ? snippetElement.textContent.trim() : '',
                        element: element.cloneNode(true)
                    });
                }
            });

            return results;
        },

        insertResults(newResults) {
            const resultsContainer = document.querySelector('#b_results');
            
            if (!resultsContainer) {
                log('Could not find Bing results container');
                return false;
            }

            newResults.forEach(result => {
                const resultElement = result.element;
                resultElement.style.borderLeft = '3px solid #0078d4';
                resultElement.style.paddingLeft = '8px';
                resultElement.style.marginBottom = '20px';
                
                resultsContainer.appendChild(resultElement);
            });

            return true;
        },

        async enhanceResults() {
            log('Starting Bing results enhancement...');
            const initialCount = this.getResultCount();
            log(`Initial result count: ${initialCount}`);

            let currentCount = initialCount;
            let first = 11; // Bing pagination starts at 11
            let attempts = 0;

            while (currentCount < CONFIG.targetResults && attempts < CONFIG.maxAttempts) {
                attempts++;
                
                const newResults = await this.fetchMoreResults(first);
                
                if (newResults.length === 0) {
                    log('No more Bing results available');
                    break;
                }

                const inserted = this.insertResults(newResults);
                if (!inserted) break;

                currentCount += newResults.length;
                first += 10;
                
                log(`Added ${newResults.length} Bing results. Total: ${currentCount}`);

                if (currentCount >= CONFIG.targetResults) break;
                await sleep(CONFIG.delay);
            }

            log(`Bing enhancement complete. Final result count: ${currentCount}`);
            return currentCount;
        }
    };

    // DuckDuckGo-specific functions
    const DuckDuckGoHandler = {
        getResultCount() {
            const results = document.querySelectorAll('[data-result]');
            return results.length;
        },

        async loadMoreResults() {
            // DuckDuckGo uses infinite scroll, simulate scroll to bottom
            window.scrollTo(0, document.body.scrollHeight);
            
            // Look for and click the "More results" button if it exists
            const moreButton = document.querySelector('.result--more__btn');
            if (moreButton && moreButton.style.display !== 'none') {
                log('Clicking DuckDuckGo more results button...');
                moreButton.click();
                return true;
            }
            
            return false;
        },

        async enhanceResults() {
            log('Starting DuckDuckGo results enhancement...');
            let lastCount = this.getResultCount();
            let attempts = 0;
            
            log(`Initial DuckDuckGo result count: ${lastCount}`);

            while (lastCount < CONFIG.targetResults && attempts < CONFIG.maxAttempts) {
                attempts++;
                
                const success = await this.loadMoreResults();
                if (!success) {
                    log('No more DuckDuckGo loading methods available');
                    break;
                }

                await sleep(CONFIG.delay);
                
                const newCount = this.getResultCount();
                if (newCount === lastCount) {
                    log('No new DuckDuckGo results loaded');
                    break;
                } else {
                    log(`Loaded ${newCount - lastCount} new DuckDuckGo results`);
                    lastCount = newCount;
                }
            }

            log(`DuckDuckGo enhancement complete. Final result count: ${lastCount}`);
            return lastCount;
        }
    };

    // Main execution
    async function main() {
        const searchEngine = detectSearchEngine();
        log(`Detected search engine: ${searchEngine}`);

        // Wait for page to fully load
        if (document.readyState !== 'complete') {
            await new Promise(resolve => {
                window.addEventListener('load', resolve);
            });
        }

        // Additional delay to ensure dynamic content is loaded
        await sleep(2000);

        let handler;
        switch (searchEngine) {
            case 'google':
                handler = GoogleHandler;
                break;
            case 'bing':
                handler = BingHandler;
                break;
            case 'duckduckgo':
                handler = DuckDuckGoHandler;
                break;
            default:
                log('Unsupported search engine');
                return;
        }

        try {
            const finalCount = await handler.enhanceResults();
            
            // Store result in extension storage for popup display
            if (chrome && chrome.storage) {
                chrome.storage.local.set({
                    lastEnhancement: {
                        searchEngine,
                        resultCount: finalCount,
                        timestamp: Date.now(),
                        url: window.location.href
                    }
                });
            }

            // Show notification to user
            showNotification(`Loaded ${finalCount} search results on this page`);
            
        } catch (error) {
            log('Error during enhancement:', error);
            showNotification('Error loading additional results', 'error');
        }
    }

    // Show notification to user
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        const bgColor = type === 'error' ? '#ea4335' : '#4285f4';
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: opacity 0.3s ease;
            max-width: 300px;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Load user settings
    async function loadSettings() {
        if (chrome && chrome.storage) {
            try {
                const result = await chrome.storage.local.get(['settings']);
                if (result.settings) {
                    CONFIG.targetResults = result.settings.targetResults || 50;
                    if (result.settings.enabled === false) {
                        log('Extension is disabled by user');
                        return false;
                    }
                }
            } catch (error) {
                log('Error loading settings:', error);
            }
        }
        return true;
    }

    // Initialize the extension
    async function init() {
        const enabled = await loadSettings();
        if (!enabled) return;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', main);
        } else {
            main();
        }
    }

    // Start the extension
    init();

})();
