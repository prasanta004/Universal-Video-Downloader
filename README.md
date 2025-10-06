Universal Video Downloader
The Universal Video Downloader is a lightweight, full-stack local application designed to retrieve video and audio streams from numerous online sources (e.g., YouTube, Instagram, X, TikTok) with granular control over format and quality.

It operates on a two-step API principle: first, it fetches all available formats (resolutions and file sizes); second, it executes the download based on the user's specific selection, ensuring standardized output formats (like MP3 for audio).

Features
Two-Step Quality Control: Fetches and displays all available resolutions (4K, 1080p, 720p, etc.) and audio formats before downloading.

Universal Source Support: Powered by yt-dlp, supporting virtually all major video hosting and social media platforms.

Audio Standardization: Automatically converts downloaded audio streams to the universally compatible MP3 format using FFmpeg.

Robust File Handling: Uses server-side logic to correctly decode long filenames and ensure the final file is served reliably to the browser, solving common "404 Not Found" errors.

Liquid Glass UI: Features a modern, responsive user interface inspired by Apple's "Liquid Glass" theme, built with pure HTML/JS and Tailwind CSS.

🛠️ Setup and Installation
This project requires a Python environment to run the server and external media handling utilities.

Prerequisites
Python 3.x

FFmpeg: Must be installed and accessible in your system's PATH (required for audio conversion).

The Latest yt-dlp Executable: Download the standalone yt-dlp.exe and place it directly in the project directory (this bypasses system PATH conflicts).

Step 1: Clone and Install Dependencies
Clone the repository and install the required Python libraries (Flask for the server, flask-cors for communication, and requests).

# Clone the repository
git clone [YOUR_REPOSITORY_LINK_HERE]
cd dynamic-downloader

# Install Python dependencies
pip install Flask flask-cors yt-dlp requests

Step 2: Place the yt-dlp.exe
Ensure the latest yt-dlp.exe file is copied directly into the root of the project folder (dynamic-downloader/).

Step 3: Start the Backend Server
Start the Flask server. This server will run continuously in your terminal.

python video_downloader_server.py

Wait for the terminal to display: * Running on http://127.0.0.1:5000

Step 4: Launch the Frontend
Open the index.html file directly in your web browser.

The HTML file will automatically connect to the local server running on port 5000.

Technical Stack
Frontend: HTML5, JavaScript (ES6+), Tailwind CSS (CDN), Lucide Icons

Backend: Python 3, Flask (REST API), Flask-CORS

Media Processing: yt-dlp (Video Extraction), FFmpeg (Audio Conversion)

📂 Project Structure
dynamic-downloader/
├── video_downloader_server.py      
├── index.html                       
├── style.css 
├── script.js
├── yt-dlp.exe                   
└── downloads/                      
