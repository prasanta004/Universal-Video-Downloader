document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons on load
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // UI elements
    const videoUrlInput = document.getElementById('videoUrl');
    const outputNameInput = document.getElementById('outputName');
    const formStep = document.getElementById('form-step');
    const formatsStep = document.getElementById('formats-step');
    const videoFormatsList = document.getElementById('videoFormatsList');
    const audioFormatsList = document.getElementById('audioFormatsList');
    const videoTitle = document.getElementById('videoTitle');
    const statusMessage = document.getElementById('statusMessage');
    const loadingArea = document.getElementById('loadingArea');
    const resultArea = document.getElementById('resultArea');
    const finalDownloadLink = document.getElementById('finalDownloadLink');
    const progressText = document.getElementById('progressText');

    // Fixed local backend URL
    const BACKEND_URL_BASE = "http://127.0.0.1:5000";
    const FORMATS_API = BACKEND_URL_BASE + "/api/formats";
    const DOWNLOAD_API = BACKEND_URL_BASE + "/api/download";

    let currentVideoUrl = ''; // Store the URL after validation

    // Expose functions to the global scope since they are called from inline 'onclick' handlers in index.html
    window.resetApp = resetApp;
    window.fetchFormats = fetchFormats;
    window.startDownload = startDownload;


    function resetApp() {
        formStep.classList.remove('hidden');
        formatsStep.classList.add('hidden');
        loadingArea.classList.add('hidden');
        resultArea.classList.add('hidden');
        statusMessage.classList.add('hidden');
        videoUrlInput.value = '';
        outputNameInput.value = '';
        videoFormatsList.innerHTML = '';
        audioFormatsList.innerHTML = '';
        currentVideoUrl = '';
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function showError(message) {
        statusMessage.textContent = message;
        statusMessage.classList.remove('hidden');
        // Ensure we are back on the form step to see the error
        formStep.classList.remove('hidden');
        loadingArea.classList.add('hidden');
        formatsStep.classList.add('hidden');
        resultArea.classList.add('hidden');
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function validateUrl(url) {
        return url.startsWith('http');
    }

    // --- STEP 1: FETCH FORMATS ---
    async function fetchFormats() {
        const url = videoUrlInput.value.trim();
        statusMessage.classList.add('hidden');

        if (!url || !validateUrl(url)) {
            showError("Please enter a valid URL starting with http.");
            return;
        }

        currentVideoUrl = url;

        // Show loading screen
        formStep.classList.add('hidden');
        loadingArea.classList.remove('hidden');
        progressText.textContent = 'Contacting server to fetch format data...';

        try {
            const payload = { url: currentVideoUrl };

            const response = await fetch(FORMATS_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.formats || result.formats.length === 0) {
                 throw new Error("No usable video formats were found for this URL.");
            }

            // Transition to format selection
            displayFormats(result.title, result.formats);

        } catch (error) {
            console.error("Format Fetch Error:", error);
            if (error.message.includes("Failed to fetch") || error.message.includes("connection refused")) {
                showError("Connection failed. Ensure the Python server is running in your terminal at http://127.0.0.1:5000.");
            } else {
                showError(`Error fetching formats: ${error.message}.`);
            }
        }
    }
    
    // Helper function to convert unusual heights into standard quality names
    function getStandardQualityTag(height, isAudio) {
        if (isAudio) return "Audio Only (MP4/M4A)";
        if (height >= 4000) return "8K (4320p)";
        if (height >= 2000) return "4K (2160p)";
        if (height >= 1400) return "1440p (QHD)";
        if (height >= 950) return "1080p (FHD)";
        if (height >= 650) return "720p (HD)";
        if (height >= 450) return "480p (SD)";
        if (height >= 300) return "360p";
        if (height >= 200) return "240p";
        if (height >= 100) return "144p";
        return `${height}p`;
    }

    // --- STEP 2: DISPLAY FORMATS ---
    function displayFormats(title, formats) {
        videoTitle.textContent = title;
        videoFormatsList.innerHTML = '';
        audioFormatsList.innerHTML = '';
        loadingArea.classList.add('hidden');
        formatsStep.classList.remove('hidden');
        
        const videoFormats = [];
        const audioFormats = [];

        formats.sort((a, b) => b.filesize_mb - a.filesize_mb);

        const seenQualities = new Set();
        
        for (const fmt of formats) {
             const isAudio = fmt.quality.includes('Audio');
             const heightMatch = fmt.quality.match(/(\d+)p/);
             const height = heightMatch ? parseInt(heightMatch[1], 10) : 0;
             
             const standardQuality = getStandardQualityTag(height, isAudio);

             const key = `${standardQuality}-${fmt.filesize_mb}-${fmt.ext}`;
             
             if (!seenQualities.has(key)) {
                fmt.displayQuality = standardQuality;
                
                if (isAudio) {
                    audioFormats.push(fmt);
                } else {
                    videoFormats.push(fmt);
                }
                seenQualities.add(key);
             }
        }
        
        // Render Video Formats - Using LIQUID GLASS classes
        videoFormats.forEach(fmt => {
            const buttonHtml = `
                <div class="flex items-center justify-between p-2 bg-slate-700/50 rounded-xl border border-white/10 shadow-md">
                    <div class="flex items-center space-x-3">
                        <i data-lucide="monitor" class="w-4 h-4 text-blue-400"></i>
                        <span class="font-bold text-white">${fmt.displayQuality}</span>
                        <span class="text-gray-300 text-sm">(${fmt.ext.toUpperCase()} - ${fmt.filesize_mb} MB)</span>
                    </div>
                    <button onclick="startDownload('${fmt.format_id}')" 
                            class="flex items-center space-x-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-sm font-semibold text-white rounded-lg transition duration-150">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        <span>Download</span>
                    </button>
                </div>
            `;
            videoFormatsList.innerHTML += buttonHtml;
        });
        
        // Render Audio Formats - Using LIQUID GLASS classes
        audioFormats.forEach(fmt => {
            const buttonHtml = `
                <div class="flex items-center justify-between p-2 bg-slate-700/50 rounded-xl border border-white/10 shadow-md">
                    <div class="flex items-center space-x-3">
                        <i data-lucide="volume-2" class="w-4 h-4 text-blue-400"></i>
                        <span class="font-bold text-white">Audio Only</span>
                        <span class="text-gray-300 text-sm">(${fmt.ext.toUpperCase()} - ${fmt.filesize_mb} MB)</span>
                    </div>
                    <button onclick="startDownload('${fmt.format_id}')" 
                            class="flex items-center space-x-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-sm font-semibold text-white rounded-lg transition duration-150">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        <span>Download</span>
                    </button>
                </div>
            `;
            audioFormatsList.innerHTML += buttonHtml;
        });

        // Hide audio section if no audio formats found
        if (audioFormats.length === 0) {
             document.querySelector('#formats-step h3:nth-of-type(2)').classList.add('hidden');
             audioFormatsList.classList.add('hidden');
        } else {
             document.querySelector('#formats-step h3:nth-of-type(2)').classList.remove('hidden');
             audioFormatsList.classList.remove('hidden');
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons(); // Re-create icons for the new buttons
        }
    }

    // --- STEP 3: START DOWNLOAD ---
    async function startDownload(formatId) {
        formatsStep.classList.add('hidden');
        loadingArea.classList.remove('hidden');
        progressText.textContent = `Starting download of format ID: ${formatId}... This may take a moment.`;

        const outputName = outputNameInput.value.trim();

        const payload = { 
            url: currentVideoUrl, 
            format_id: formatId, 
            output_name: outputName
        };

        try {
            const response = await fetch(DOWNLOAD_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Transition to download confirmation
            loadingArea.classList.add('hidden');
            resultArea.classList.remove('hidden');
            
            // Constructs the file serving URL
            finalDownloadLink.href = BACKEND_URL_BASE + "/downloads/" + encodeURIComponent(result.filename); 
            finalDownloadLink.setAttribute('download', result.filename);
            finalDownloadLink.querySelector('span').textContent = `Download ${result.filename}`;

        } catch (error) {
            console.error("Download Error:", error);
            showError(`Download failed: ${error.message}.`);
        }
    }
});