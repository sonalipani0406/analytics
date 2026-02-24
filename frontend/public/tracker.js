(function() {

'use strict';

// ===================================================================
// SUPER ROBUST TRACKER - NEVER-FAIL IP/LOCATION FETCHING
// ===================================================================

const flaskEndpoint = 'http://localhost:5000';
const trackEndpoint = `${flaskEndpoint}/track`;
const durationEndpoint = `${flaskEndpoint}/log/time`;

// OPTIMIZED: More reliable intervals based on working reference
const HEARTBEAT_INTERVALS = {
    desktop: 8000,
    mobile: 5000,
    tor: 15000,
    samsung: 4000
};

const BACKUP_INTERVALS = {
    desktop: 10000,
    mobile: 6000,
    tor: 20000,
    samsung: 5000
};

const STORAGE_KEY = 'universal_page_tracker';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [500, 1000, 2000];
const NETWORK_TIMEOUT_MS = 8000;
const IDLE_THRESHOLD_MS = 60000;
const SESSION_DURATION_HOURS = 24;
const UNLOAD_TIMEOUT_MS = 100;

// ===================================================================
// SUPER ROBUST IP/LOCATION SERVICES - NEVER FAILS
// ===================================================================

const IP_LOCATION_SERVICES = [
    // Service 1: ipapi.co - Usually CORS enabled, comprehensive data
    {
        name: 'ipapi.co',
        url: 'https://ipapi.co/json/',
        timeout: 3000,
        method: 'fetch',
        parser: (data) => ({
            publicIp: data.ip || 'unknown',
            country: data.country_name || 'unknown',
            city: data.city || 'unknown',
            countryCode: data.country_code || 'unknown',
            region: data.region || 'unknown',
            isp: data.org || 'unknown'
        })
    },
    
    // Service 2: freegeoip.app - Good CORS support
    {
        name: 'freegeoip.app',
        url: 'https://freegeoip.app/json/',
        timeout: 3000,
        method: 'fetch',
        parser: (data) => ({
            publicIp: data.ip || 'unknown',
            country: data.country_name || 'unknown',
            city: data.city || 'unknown',
            countryCode: data.country_code || 'unknown',
            region: data.region_name || 'unknown',
            isp: 'unknown'
        })
    },
    
    // Service 3: ip-api.com - Has CORS, rate limited but good data
    {
        name: 'ip-api.com',
        url: 'https://ip-api.com/json/?fields=status,message,country,countryCode,region,city,isp,query',
        timeout: 3000,
        method: 'fetch',
        parser: (data) => ({
            publicIp: data.query || 'unknown',
            country: data.country || 'unknown',
            city: data.city || 'unknown',
            countryCode: data.countryCode || 'unknown',
            region: data.region || 'unknown',
            isp: data.isp || 'unknown'
        })
    },
    
    // Service 4: httpbin.org - Very reliable for IP only
    {
        name: 'httpbin.org',
        url: 'https://httpbin.org/ip',
        timeout: 2000,
        method: 'fetch',
        parser: (data) => ({
            publicIp: data.origin ? data.origin.split(',')[0].trim() : 'unknown',
            country: 'unknown',
            city: 'unknown',
            countryCode: 'unknown',
            region: 'unknown',
            isp: 'unknown'
        })
    },
    
    // Service 5: ipify with JSONP fallback
    {
        name: 'ipify',
        url: 'https://api.ipify.org?format=json',
        timeout: 2000,
        method: 'fetch',
        jsonpUrl: 'https://api.ipify.org?format=jsonp&callback=',
        parser: (data) => ({
            publicIp: data.ip || 'unknown',
            country: 'unknown',
            city: 'unknown',
            countryCode: 'unknown',
            region: 'unknown',
            isp: 'unknown'
        })
    },
    
    // Service 6: jsonip.com - JSONP support
    {
        name: 'jsonip.com',
        url: 'https://jsonip.com/',
        timeout: 2000,
        method: 'fetch',
        jsonpUrl: 'https://jsonip.com/?callback=',
        parser: (data) => ({
            publicIp: data.ip || 'unknown',
            country: 'unknown',
            city: 'unknown',
            countryCode: 'unknown',
            region: 'unknown',
            isp: 'unknown'
        })
    }
];

// Cache configuration
const GEOLOCATION_CACHE = {
    key: 'ip_location_cache',
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
    data: null,
    timestamp: 0
};

// ===================================================================
// UNIVERSAL BROWSER DETECTION
// ===================================================================

const userAgent = navigator.userAgent || '';
const browserInfo = {
    // Desktop browsers
    isChrome: /Chrome/.test(userAgent) && !/Edg|OPR|Samsung/.test(userAgent),
    isFirefox: /Firefox/.test(userAgent),
    isEdge: /Edg/.test(userAgent),
    isSafari: /Safari/.test(userAgent) && !/Chrome|Chromium/.test(userAgent),
    isOpera: /OPR|Opera/.test(userAgent),
    isTor: /Tor/.test(userAgent) || (window.navigator && window.navigator.hardwareConcurrency === 2),
    
    // Mobile browsers
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
    isIOS: /iPad|iPhone|iPod/.test(userAgent),
    isAndroid: /Android/i.test(userAgent),
    isChromeMobile: /Chrome/.test(userAgent) && /Mobile|Android/i.test(userAgent),
    isSamsungBrowser: /SamsungBrowser|Samsung Internet/.test(userAgent),
    isMobileSafari: /Version.*Safari/.test(userAgent) && /Mobile/i.test(userAgent),
    isFirefoxMobile: /Firefox/.test(userAgent) && /Mobile|Tablet/i.test(userAgent),
    isMIBrowser: /MiBrowser|XiaoMi/i.test(userAgent),
    isUCBrowser: /UCBrowser|UCWEB/i.test(userAgent),
    isOperaMini: /Opera Mini/i.test(userAgent),
    isOperaMobile: /Opera Mobi/i.test(userAgent),
    
    // Vendor specific
    isWebView: /wv\)|WebView/.test(userAgent),
    isHuaweiBrowser: /HuaweiBrowser/i.test(userAgent),
    isVivoBrowser: /VivoBrowser/i.test(userAgent),
    isOppoBrowser: /OppoBrowser/i.test(userAgent),
    
    // Feature detection
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    hasOrientation: 'orientation' in window
};

// Determine browser category for timing
let browserCategory = 'desktop';
if (browserInfo.isTor) {
    browserCategory = 'tor';
} else if (browserInfo.isSamsungBrowser) {
    browserCategory = 'samsung';
} else if (browserInfo.isMobile) {
    browserCategory = 'mobile';
}

const CURRENT_HEARTBEAT_INTERVAL = HEARTBEAT_INTERVALS[browserCategory];
const CURRENT_BACKUP_INTERVAL = BACKUP_INTERVALS[browserCategory];

// ===================================================================
// STATE MANAGEMENT
// ===================================================================

let sessionId;
let heartbeatIntervalId = null;
let backupIntervalId = null;
let idleCheckIntervalId = null;
let failsafeIntervalId = null;
let isPageUnloading = false;
let isSendingFinalUpdate = false;
let isInitialized = false;

const startTime = Date.now();
let lastActivityTime = startTime;
let lastSuccessfulHeartbeat = startTime;
let totalTimeSpent = 0;
let isPageVisible = !document.hidden;
let visibilityStartTime = isPageVisible ? startTime : null;
let isUserIdle = false;
let consecutiveFailures = 0;
let cachedLocationData = null;

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

function generateUUID() {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {
        // Continue to fallback
    }
    
    try {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            array[6] = (array[6] & 0x0f) | 0x40; // Version 4
            array[8] = (array[8] & 0x3f) | 0x80; // Variant bits
            const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
        }
    } catch (e) {
        // Continue to fallback
    }
    
    // Fallback method for all browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ===================================================================
// UNIVERSAL STORAGE MANAGEMENT
// ===================================================================

function getStorage() {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('__test__', '1');
            sessionStorage.removeItem('__test__');
            return sessionStorage;
        }
    } catch (e) {
        // Continue to fallback
    }
    
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('__test__', '1');
            localStorage.removeItem('__test__');
            return localStorage;
        }
    } catch (e) {
        // Continue to fallback
    }
    
    // Cookie fallback for very old browsers
    return {
        getItem: function(key) {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.split('=').map(s => s.trim());
                if (name === key) {
                    return decodeURIComponent(value);
                }
            }
            return null;
        },
        setItem: function(key, value) {
            const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
            document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
        }
    };
}

function initializeSession() {
    try {
        const storage = getStorage();
        const stored = storage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            const sessionAge = Date.now() - (data.startTime || 0);
            if (data.sessionId && sessionAge < SESSION_DURATION_HOURS * 60 * 60 * 1000) {
                sessionId = data.sessionId;
                totalTimeSpent = data.totalTimeSpent || 0;
                lastSuccessfulHeartbeat = data.lastSuccessfulHeartbeat || startTime;
                lastActivityTime = data.lastActivityTime || startTime;
                cachedLocationData = data.cachedLocationData || null;
                return;
            }
        }
    } catch (e) {
        console.warn('Tracker: Could not restore session');
    }
    
    sessionId = generateUUID();
    totalTimeSpent = 0;
    lastSuccessfulHeartbeat = startTime;
    lastActivityTime = startTime;
    cachedLocationData = null;
}

function loadCachedLocationData() {
    try {
        const storage = getStorage();
        const cached = storage.getItem(GEOLOCATION_CACHE.key);
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp < GEOLOCATION_CACHE.maxAge) {
                GEOLOCATION_CACHE.data = data.locationData;
                GEOLOCATION_CACHE.timestamp = data.timestamp;
                return data.locationData;
            }
        }
    } catch (e) {
        // Ignore cache errors
    }
    return null;
}

function saveCachedLocationData(locationData) {
    try {
        const storage = getStorage();
        const cacheData = {
            locationData: locationData,
            timestamp: Date.now()
        };
        storage.setItem(GEOLOCATION_CACHE.key, JSON.stringify(cacheData));
        GEOLOCATION_CACHE.data = locationData;
        GEOLOCATION_CACHE.timestamp = Date.now();
    } catch (e) {
        // Ignore cache save errors
    }
}

function backupSessionData() {
    // Non-blocking backup
    setTimeout(() => {
        try {
            const currentTime = Date.now();
            if (isPageVisible && visibilityStartTime && !isUserIdle) {
                totalTimeSpent += currentTime - visibilityStartTime;
                visibilityStartTime = currentTime;
            }
            
            const sessionData = {
                sessionId: sessionId,
                startTime: startTime,
                totalTimeSpent: totalTimeSpent,
                lastSuccessfulHeartbeat: lastSuccessfulHeartbeat,
                lastActivityTime: lastActivityTime,
                lastBackup: currentTime,
                browserInfo: browserInfo,
                browserCategory: browserCategory,
                cachedLocationData: cachedLocationData
            };
            
            const storage = getStorage();
            storage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
        } catch (e) {
            // Silent fail for backup
        }
    }, 0);
}

// ===================================================================
// UNIVERSAL ACTIVITY DETECTION
// ===================================================================

function updateActivity() {
    lastActivityTime = Date.now();
    if (isUserIdle) {
        isUserIdle = false;
        if (isPageVisible && !visibilityStartTime) {
            visibilityStartTime = Date.now();
        }
    }
}

function setupActivityListeners() {
    const events = [
        // Universal events
        'click', 'keypress', 'keydown', 'mousemove', 'scroll',
        // Mobile events
        'touchstart', 'touchmove', 'touchend',
        // Focus events
        'focus', 'blur',
        // Resize events
        'resize'
    ];
    
    events.forEach(eventName => {
        try {
            document.addEventListener(eventName, updateActivity, { passive: true });
        } catch (e) {
            // Some browsers may not support passive listeners
            try {
                document.addEventListener(eventName, updateActivity, false);
            } catch (e2) {
                // Event not supported, skip
            }
        }
    });
    
    // Window events
    try {
        window.addEventListener('focus', updateActivity, { passive: true });
        window.addEventListener('blur', updateActivity, { passive: true });
    } catch (e) {
        try {
            window.addEventListener('focus', updateActivity);
            window.addEventListener('blur', updateActivity);
        } catch (e2) {
            // Fallback for very old browsers
        }
    }
    
    // Orientation change for mobile
    if (browserInfo.isMobile && browserInfo.hasOrientation) {
        try {
            window.addEventListener('orientationchange', updateActivity, { passive: true });
        } catch (e) {
            // Not supported
        }
    }
}

function checkIdleStatus() {
    const currentTime = Date.now();
    const timeSinceActivity = currentTime - lastActivityTime;
    
    if (!isUserIdle && timeSinceActivity > IDLE_THRESHOLD_MS) {
        isUserIdle = true;
        if (visibilityStartTime) {
            totalTimeSpent += Math.min(IDLE_THRESHOLD_MS, currentTime - visibilityStartTime);
            visibilityStartTime = null;
        }
    }
    
    backupSessionData();
}

// ===================================================================
// SUPER ROBUST NETWORK REQUESTS - NEVER FAIL
// ===================================================================

async function makeRequest(url, options = {}, timeout = NETWORK_TIMEOUT_MS) {
    const methods = [];
    
    // Method 1: Modern fetch API with timeout
    if (typeof fetch !== 'undefined') {
        methods.push(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            try {
                const fetchOptions = {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-cache',
                    credentials: 'omit',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': navigator.userAgent || 'Mozilla/5.0'
                    },
                    signal: controller.signal,
                    ...options
                };
                
                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const data = await response.json();
                    return { success: true, data };
                }
                throw new Error(`HTTP ${response.status}`);
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        });
    }
    
    // Method 2: XMLHttpRequest fallback
    methods.push(() => {
        return new Promise((resolve, reject) => {
            try {
                const xhr = new XMLHttpRequest();
                xhr.timeout = timeout;
                xhr.withCredentials = false;
                
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const data = JSON.parse(xhr.responseText || '{}');
                            resolve({ success: true, data });
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                };
                
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.ontimeout = () => reject(new Error('Request timeout'));
                
                xhr.open(options.method || 'GET', url, true);
                
                // Set headers
                xhr.setRequestHeader('Accept', 'application/json');
                if (options.headers) {
                    Object.entries(options.headers).forEach(([key, value]) => {
                        xhr.setRequestHeader(key, value);
                    });
                }
                
                xhr.send(options.body || null);
            } catch (error) {
                reject(error);
            }
        });
    });
    
    // Try each method
    for (let i = 0; i < methods.length; i++) {
        try {
            return await methods[i]();
        } catch (error) {
            if (i === methods.length - 1) {
                throw error;
            }
        }
    }
}

// JSONP support for services that offer it
function makeJSONPRequest(url, timeout = 3000) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        
        // Timeout handler
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP timeout'));
        }, timeout);
        
        // Cleanup function
        function cleanup() {
            if (window[callbackName]) {
                delete window[callbackName];
            }
            if (script && script.parentNode) {
                script.parentNode.removeChild(script);
            }
            clearTimeout(timeoutId);
        }
        
        // Set up callback
        window[callbackName] = function(data) {
            cleanup();
            resolve({ success: true, data });
        };
        
        // Create script tag
        const script = document.createElement('script');
        script.onerror = () => {
            cleanup();
            reject(new Error('JSONP script error'));
        };
        
        script.src = url + callbackName;
        document.head.appendChild(script);
    });
}

// ===================================================================
// SUPER ROBUST IP/LOCATION FETCHING - NEVER FAILS
// ===================================================================

async function fetchIPLocation() {
    // First, try to load from cache
    const cached = loadCachedLocationData();
    if (cached) {
        console.log('Tracker: Using cached location data');
        return cached;
    }
    
    // Default fallback data - this ensures we NEVER fail
    const defaultData = {
        publicIp: 'unknown',
        country: 'unknown',
        city: 'unknown',
        countryCode: 'unknown',
        region: 'unknown',
        isp: 'unknown'
    };
    
    // Skip for privacy-focused browsers (return default but don't try to fetch)
    if (browserInfo.isTor) {
        const torData = {
            publicIp: 'tor-network',
            country: 'unknown',
            city: 'unknown', 
            countryCode: 'unknown',
            region: 'unknown',
            isp: 'tor'
        };
        saveCachedLocationData(torData);
        return torData;
    }
    
    // For mobile, try but use shorter timeout and fewer services for battery
    const servicesToTry = browserInfo.isMobile ? IP_LOCATION_SERVICES.slice(0, 3) : IP_LOCATION_SERVICES;
    
    // Try each service in sequence
    for (const service of servicesToTry) {
        try {
            console.log(`Tracker: Trying ${service.name}...`);
            
            let result = null;
            
            // Try primary method first
            if (service.method === 'fetch') {
                try {
                    result = await makeRequest(service.url, {}, service.timeout);
                } catch (error) {
                    // If CORS fails, try JSONP if available
                    if (service.jsonpUrl && error.message.includes('CORS')) {
                        console.log(`Tracker: ${service.name} CORS failed, trying JSONP...`);
                        try {
                            result = await makeJSONPRequest(service.jsonpUrl, service.timeout);
                        } catch (jsonpError) {
                            console.warn(`Tracker: ${service.name} JSONP also failed:`, jsonpError.message);
                            continue;
                        }
                    } else {
                        throw error;
                    }
                }
            }
            
            if (result && result.success) {
                const locationData = service.parser(result.data);
                
                // Merge with any existing partial data from previous attempts
                const mergedData = { ...defaultData };
                Object.keys(locationData).forEach(key => {
                    if (locationData[key] && locationData[key] !== 'unknown') {
                        mergedData[key] = locationData[key];
                    }
                });
                
                console.log(`Tracker: Successfully got data from ${service.name}`);
                saveCachedLocationData(mergedData);
                return mergedData;
            }
            
        } catch (error) {
            console.warn(`Tracker: ${service.name} failed:`, error.message);
            continue;
        }
    }
    
    // If we get here, all services failed - use default data
    console.warn('Tracker: All IP/location services failed, using defaults');
    saveCachedLocationData(defaultData);
    return defaultData;
}

async function getVisitorData() {
    const locationData = await fetchIPLocation();
    
    const baseData = {
        sessionId: sessionId,
        timestamp: Date.now(),
        pageVisited: window.location.href,
        userAgent: userAgent,
        browserInfo: browserInfo,
        browserCategory: browserCategory,
        screenWidth: screen.width || 0,
        screenHeight: screen.height || 0
    };
    
    return { ...baseData, ...locationData };
}

// ===================================================================
// IMPROVED NETWORK REQUESTS FOR OWN ENDPOINTS
// ===================================================================

async function universalFetch(url, options, retryAttempt = 0) {
    const methods = [];
    
    // Method 1: Modern fetch API with improved configuration for CORS
    if (typeof fetch !== 'undefined') {
        methods.push(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
            
            try {
                const fetchOptions = {
                    method: 'POST',
                    mode: 'cors',
                    cache: 'no-cache',
                    credentials: 'omit',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Agent': navigator.userAgent || 'Mozilla/5.0'
                    },
                    signal: controller.signal,
                    ...options
                };
                
                // Use keepalive when appropriate and safe
                if (!browserInfo.isTor && !browserInfo.isSafari && 
                    typeof Request !== 'undefined') {
                    try {
                        if ('keepalive' in new Request('')) {
                            fetchOptions.keepalive = true;
                        }
                    } catch (e) {
                        // keepalive not supported
                    }
                }
                
                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    return response;
                }
                throw new Error(`HTTP ${response.status}`);
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        });
    }
    
    // Method 2: XMLHttpRequest fallback with proper CORS handling
    methods.push(() => {
        return new Promise((resolve, reject) => {
            try {
                const xhr = new XMLHttpRequest();
                xhr.timeout = NETWORK_TIMEOUT_MS;
                xhr.withCredentials = false; // Important for CORS
                
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve({
                            ok: true,
                            status: xhr.status,
                            json: () => Promise.resolve(JSON.parse(xhr.responseText || '{}'))
                        });
                    } else {
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                };
                
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.ontimeout = () => reject(new Error('Request timeout'));
                
                xhr.open(options.method || 'GET', url, true);
                
                // Set headers properly for CORS
                if (options.headers) {
                    Object.entries(options.headers).forEach(([key, value]) => {
                        xhr.setRequestHeader(key, value);
                    });
                }
                
                xhr.send(options.body || null);
            } catch (error) {
                reject(error);
            }
        });
    });
    
    // Try each method
    for (let i = 0; i < methods.length; i++) {
        try {
            const result = await methods[i]();
            consecutiveFailures = 0;
            return result;
        } catch (error) {
            if (i === methods.length - 1) {
                // All methods failed, try retry logic
                if (retryAttempt < MAX_RETRY_ATTEMPTS) {
                    const baseDelay = RETRY_DELAYS[retryAttempt] || 2000;
                    const jitter = Math.random() * 200;
                    const delay = baseDelay + jitter;
                    
                    console.warn(`Tracker: Request failed, retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return universalFetch(url, options, retryAttempt + 1);
                }
                
                consecutiveFailures++;
                throw error;
            }
        }
    }
}

// ===================================================================
// CORE FUNCTIONS
// ===================================================================

async function sendInitialData() {
    // Non-blocking with timeout
    setTimeout(async () => {
        try {
            const data = await getVisitorData();
            await universalFetch(trackEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            console.log(`Tracker: Initial data sent successfully - ${data.city}, ${data.country}`);
        } catch (error) {
            console.warn('Tracker: Failed to send initial data:', error.message);
        }
    }, 200);
}

function calculateCurrentTimeSpent() {
    const currentTime = Date.now();
    let currentTotalTime = totalTimeSpent;
    
    if (isPageVisible && visibilityStartTime && !isUserIdle) {
        currentTotalTime += currentTime - visibilityStartTime;
    }
    
    return Math.max(0, Math.round(currentTotalTime / 1000));
}

async function sendHeartbeatUpdate() {
    if (isPageUnloading || isSendingFinalUpdate || !isPageVisible || isUserIdle) {
        return;
    }
    
    const timeSpentSeconds = calculateCurrentTimeSpent();
    if (timeSpentSeconds <= 0) {
        return;
    }
    
    const data = {
        sessionId: sessionId,
        timeSpentSeconds: timeSpentSeconds,
        isHeartbeat: true,
        timestamp: Date.now(),
        browserCategory: browserCategory,
        consecutiveFailures: consecutiveFailures
    };
    
    try {
        await universalFetch(durationEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        lastSuccessfulHeartbeat = Date.now();
        backupSessionData();
    } catch (error) {
        console.warn('Tracker: Heartbeat failed:', error.message);
    }
}

// ===================================================================
// MULTI-METHOD FINAL UPDATE
// ===================================================================

function sendFinalUpdate() {
    if (isSendingFinalUpdate) return;
    isSendingFinalUpdate = true;
    
    // Clear all intervals immediately
    [heartbeatIntervalId, backupIntervalId, idleCheckIntervalId, failsafeIntervalId].forEach(id => {
        if (id) clearInterval(id);
    });
    
    const timeSpentSeconds = calculateCurrentTimeSpent();
    if (timeSpentSeconds <= 0) return;
    
    const data = {
        sessionId: sessionId,
        timeSpentSeconds: timeSpentSeconds,
        isFinal: true,
        timestamp: Date.now(),
        browserCategory: browserCategory
    };
    
    const payload = JSON.stringify(data);
    const sendMethods = [];
    
    // Method 1: sendBeacon (most reliable for page unload)
    if (navigator.sendBeacon) {
        sendMethods.push(() => {
            try {
                const blob = new Blob([payload], { type: 'application/json' });
                return navigator.sendBeacon(durationEndpoint, blob);
            } catch (e) {
                return false;
            }
        });
    }
    
    // Method 2: fetch with keepalive (modern browsers, avoid Safari/Tor issues)
    if (!browserInfo.isSafari && !browserInfo.isTor && typeof fetch !== 'undefined') {
        try {
            if ('keepalive' in new Request('')) {
                sendMethods.push(() => {
                    try {
                        fetch(durationEndpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: payload,
                            keepalive: true,
                            mode: 'cors'
                        });
                        return true;
                    } catch (e) {
                        return false;
                    }
                });
            }
        } catch (e) {
            // keepalive not supported
        }
    }
    
    // Method 3: synchronous XHR (last resort)
    sendMethods.push(() => {
        try {
            const xhr = new XMLHttpRequest();
            xhr.timeout = UNLOAD_TIMEOUT_MS;
            xhr.open('POST', durationEndpoint, false); // synchronous
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(payload);
            return xhr.status >= 200 && xhr.status < 300;
        } catch (e) {
            return false;
        }
    });
    
    // Try each method until one succeeds
    let success = false;
    for (const method of sendMethods) {
        try {
            if (method()) {
                success = true;
                break;
            }
        } catch (e) {
            // Continue to next method
        }
    }
    
    if (success) {
        backupSessionData();
    }
}

// ===================================================================
// UNIVERSAL VISIBILITY HANDLING
// ===================================================================

function handleVisibilityChange() {
    const currentTime = Date.now();
    const wasVisible = isPageVisible;
    
    // Multiple methods to detect visibility
    let newVisibility = true;
    if (typeof document.hidden !== 'undefined') {
        newVisibility = !document.hidden;
    } else if (typeof document.webkitHidden !== 'undefined') {
        newVisibility = !document.webkitHidden;
    } else if (typeof document.mozHidden !== 'undefined') {
        newVisibility = !document.mozHidden;
    } else if (typeof document.msHidden !== 'undefined') {
        newVisibility = !document.msHidden;
    } else if (document.visibilityState) {
        newVisibility = document.visibilityState === 'visible';
    }
    
    isPageVisible = newVisibility;
    updateActivity();
    
    if (wasVisible && !isPageVisible) {
        // Page became hidden
        if (visibilityStartTime && !isUserIdle) {
            totalTimeSpent += currentTime - visibilityStartTime;
            visibilityStartTime = null;
        }
        
        if (heartbeatIntervalId) {
            clearInterval(heartbeatIntervalId);
            heartbeatIntervalId = null;
        }
        
        // Send immediate update
        setTimeout(() => {
            if (!isPageVisible && !isPageUnloading) {
                sendHeartbeatUpdate();
            }
        }, 100);
        
    } else if (!wasVisible && isPageVisible) {
        // Page became visible
        if (!isUserIdle) {
            visibilityStartTime = currentTime;
        }
        
        if (!heartbeatIntervalId && !isPageUnloading) {
            heartbeatIntervalId = setInterval(sendHeartbeatUpdate, CURRENT_HEARTBEAT_INTERVAL);
        }
    }
    
    backupSessionData();
}

// ===================================================================
// UNIVERSAL EVENT SETUP
// ===================================================================

function setupUniversalEvents() {
    // Visibility change events
    const visibilityEvents = [
        'visibilitychange',
        'webkitvisibilitychange',
        'mozvisibilitychange',
        'msvisibilitychange'
    ];
    
    visibilityEvents.forEach(eventName => {
        try {
            document.addEventListener(eventName, handleVisibilityChange, { passive: true });
        } catch (e) {
            try {
                document.addEventListener(eventName, handleVisibilityChange);
            } catch (e2) {
                // Event not supported
            }
        }
    });
    
    // Page unload events - based on browser type
    const unloadEvents = [];
    if (browserInfo.isSamsungBrowser || browserInfo.isChromeMobile) {
        unloadEvents.push('pagehide', 'beforeunload');
    } else if (browserInfo.isMobileSafari || browserInfo.isIOS) {
        unloadEvents.push('pagehide');
    } else if (browserInfo.isFirefoxMobile) {
        unloadEvents.push('pagehide', 'beforeunload');
    } else if (browserInfo.isTor) {
        unloadEvents.push('beforeunload', 'pagehide');
    } else {
        // Desktop browsers
        unloadEvents.push('beforeunload', 'pagehide', 'unload');
    }
    
    unloadEvents.forEach(eventName => {
        try {
            window.addEventListener(eventName, () => {
                if (!isPageUnloading) {
                    isPageUnloading = true;
                    sendFinalUpdate();
                }
            }, { passive: true });
        } catch (e) {
            try {
                window.addEventListener(eventName, () => {
                    if (!isPageUnloading) {
                        isPageUnloading = true;
                        sendFinalUpdate();
                    }
                });
            } catch (e2) {
                // Event not supported
            }
        }
    });
    
    // Focus/blur events for app switching - mobile specific
    if (browserInfo.isMobile) {
        try {
            window.addEventListener('blur', () => {
                setTimeout(() => {
                    if (!isPageVisible && !isPageUnloading) {
                        isPageUnloading = true;
                        sendFinalUpdate();
                    }
                }, 1000);
            }, { passive: true });
        } catch (e) {
            // Not supported
        }
    }
}

// ===================================================================
// FAILSAFE MECHANISM
// ===================================================================

function setupFailsafe() {
    // Failsafe: periodic check and send if too much time has passed
    failsafeIntervalId = setInterval(() => {
        const timeSinceLastSuccess = Date.now() - lastSuccessfulHeartbeat;
        const maxInterval = CURRENT_HEARTBEAT_INTERVAL * 3; // 3x normal interval
        
        if (timeSinceLastSuccess > maxInterval && isPageVisible && !isUserIdle && !isPageUnloading) {
            sendHeartbeatUpdate();
        }
    }, CURRENT_HEARTBEAT_INTERVAL * 2);
}

// ===================================================================
// INITIALIZATION
// ===================================================================

function initialize() {
    if (isInitialized) return;
    isInitialized = true;
    
    try {
        initializeSession();
        setupActivityListeners();
        setupUniversalEvents();
        setupFailsafe();
        
        // Send initial data
        sendInitialData();
        
        // Start heartbeat
        if (isPageVisible && !isUserIdle) {
            heartbeatIntervalId = setInterval(sendHeartbeatUpdate, CURRENT_HEARTBEAT_INTERVAL);
            visibilityStartTime = Date.now();
        }
        
        // Start backup
        backupIntervalId = setInterval(backupSessionData, CURRENT_BACKUP_INTERVAL);
        
        // Start idle checking
        idleCheckIntervalId = setInterval(checkIdleStatus, 15000); // Every 15 seconds
        
        console.log(`Tracker: Initialized successfully (${browserCategory}, Network timeout: ${NETWORK_TIMEOUT_MS}ms)`);
        
    } catch (error) {
        console.error('Tracker: Initialization failed', error);
    }
}

// ===================================================================
// UNIVERSAL DOM READY
// ===================================================================

function domReady(callback) {
    if (document.readyState === 'loading') {
        const events = ['DOMContentLoaded', 'load'];
        let called = false;
        const handler = () => {
            if (!called) {
                called = true;
                callback();
            }
        };
        
        events.forEach(eventName => {
            try {
                document.addEventListener(eventName, handler);
            } catch (e) {
                // Event not supported
            }
        });
        
        // Failsafe timeout
        setTimeout(() => {
            if (!called) {
                called = true;
                callback();
            }
        }, 5000);
    } else {
        // Add delay for mobile browsers
        setTimeout(callback, browserInfo.isMobile ? 200 : 50);
    }
}

// ===================================================================
// START EVERYTHING
// ===================================================================

domReady(initialize);

// Global error handler to prevent script crashes
try {
    window.addEventListener('error', (event) => {
        // Don't let errors crash the tracker
        event.preventDefault();
        return false;
    });
} catch (e) {
    // Error handling not supported
}

})();
