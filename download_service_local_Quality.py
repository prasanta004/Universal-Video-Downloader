import subprocess
import json
import os
import re
import tempfile
import urllib.parse
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# --- FLASK SETUP & CONFIGURATION ---
app = Flask(__name__)
CORS(app) 

# PATHS
DOWNLOAD_DIR = os.path.join(os.getcwd(), 'downloads')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)
HOST_IP = '127.0.0.1'
PORT = 5000

# --- HELPER FUNCTION: YT-DLP CORE LOGIC ---

def call_yt_dlp_formats(url):
    """Fetches available formats and video metadata by parsing yt-dlp's text output."""
    try:
        # 1. Fetch formats list as text (more reliable for format display)
        cmd_formats = [
            'yt-dlp', 
            '--list-formats',
            '--restrict-filenames',
            '--no-warnings',
            url
        ]
        
        # Execute the command to get format list text
        result_formats = subprocess.run(cmd_formats, capture_output=True, text=True, check=True, encoding='utf-8')
        formats_text = result_formats.stdout
        
        # 2. Extract Title from metadata (separate command for cleaner title)
        cmd_title = [
            'yt-dlp', 
            '--print', '%(title)s',
            '--skip-download',
            url
        ]
        # Execute the command to get the title
        result_title = subprocess.run(cmd_title, capture_output=True, text=True, check=True, encoding='utf-8')
        title = result_title.stdout.strip()
        
        formats_list = []
        
        # 3. Parse the text output line by line
        for line in formats_text.splitlines():
            # Filter lines containing file size info (MiB/KiB) and check for format ID
            if re.search(r'MiB|KiB|GiB', line, re.IGNORECASE) and not re.search(r'format code|resolution|ext', line, re.IGNORECASE):
                
                parts = line.split()
                if len(parts) > 5 and parts[0].isdigit():
                    
                    format_id = parts[0]
                    resolution = ""
                    filesize_str = ""
                    ext = ""
                    
                    # Heuristic parsing to find resolution, size, and extension
                    for part in parts[1:]:
                        if re.match(r'\d+x\d+', part):
                            resolution = part.split('x')[1] + 'p'
                        elif part == 'audio' or part == 'audio-only':
                            resolution = 'Audio Only'
                        elif re.match(r'[\d.]+(MiB|KiB|GiB|MB|KB)', part, re.IGNORECASE):
                            filesize_str = part
                        elif re.match(r'\w{2,4}', part) and len(part) <= 4 and part.lower() not in ['none', 'n/a']:
                            ext = part
                            
                    if not resolution or not ext or not filesize_str:
                        continue
                        
                    # Calculate size in MB
                    size_match = re.search(r'([\d.]+)', filesize_str)
                    unit_match = re.search(r'(MiB|KiB|GiB|MB|KB)', filesize_str, re.IGNORECASE)
                    
                    if size_match and unit_match:
                        size_value = float(size_match.group(1))
                        unit = unit_match.group(1).upper()
                        
                        if unit in ['GIB', 'GB']:
                            size_mb = round(size_value * 1024, 2)
                        elif unit in ['KIB', 'KB']:
                            size_mb = round(size_value / 1024, 2)
                        elif unit in ['MB', 'MIB']: 
                            size_mb = round(size_value, 2)
                        else:
                            size_mb = round(size_value, 2)
                        
                        formats_list.append({
                            'format_id': format_id,
                            'quality': resolution,
                            'ext': ext,
                            'filesize_mb': size_mb
                        })

        if not formats_list:
            raise Exception("No usable formats found. Video may be private, age-restricted, or unsupported.")

        return title, formats_list

    except subprocess.CalledProcessError as e:
        print(f"yt-dlp command failed with code {e.returncode}: {e.stderr}")
        raise Exception(f"Failed to fetch video information. {e.stderr.strip().splitlines()[-1]}")
    except FileNotFoundError:
        raise Exception("yt-dlp executable not found. Please ensure yt-dlp.exe is in the same folder as the Python script.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise Exception("An unexpected error occurred while processing the URL.")

# --- API ROUTES ---

@app.route('/api/formats', methods=['POST'])
def get_formats():
    """Endpoint to fetch available formats and video title."""
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL not provided.'}), 400
    
    try:
        title, formats = call_yt_dlp_formats(url)
        return jsonify({'title': title, 'formats': formats}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/download', methods=['POST'])
def download_video():
    """Endpoint to handle the actual video download."""
    data = request.json
    url = data.get('url')
    format_id = data.get('format_id')
    output_name_raw = data.get('output_name')
    
    if not all([url, format_id]):
        return jsonify({'error': 'URL and format_id are required.'}), 400

    try:
        # 1. Prepare filename template
        filename_template = os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s')
        
        if output_name_raw:
            # Sanitize the custom name
            sanitized_name = re.sub(r'[\\/:*?"<>|]', '', output_name_raw)
            filename_template = os.path.join(DOWNLOAD_DIR, f'{sanitized_name}.%(ext)s')
        
        # 2. yt-dlp command construction
        cmd = [
            'yt-dlp', 
            '-f', format_id,
            '--output', filename_template,
            '--print', 'after_move:%(filepath)s', # CRITICAL: Prints the final path after merging/moving
            url
        ]
        
        # 3. Execute command and capture output
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, encoding='utf-8')
        
        # 4. Extract final filename
        final_filepath = result.stdout.strip()
        final_filename = os.path.basename(final_filepath) # Extract just the filename from the path

        if not final_filename:
            # Fallback for empty filename
            raise Exception("Download successful, but final filename could not be determined.")
        
        return jsonify({'filename': final_filename}), 200

    except subprocess.CalledProcessError as e:
        print(f"yt-dlp command failed during download: {e.stderr}")
        return jsonify({'error': f"Download failed. The site may be blocking access or the video is restricted. Details: {e.stderr.strip().splitlines()[-1]}"}), 500
    except FileNotFoundError:
        raise Exception("yt-dlp executable not found. Please ensure yt-dlp.exe is in the same folder as the Python script.")
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/downloads/<path:filename>', methods=['GET'])
def serve_downloaded_file(filename):
    """Serves the downloaded files from the temporary directory, robustly searching the folder."""
    try:
        # 1. Search the directory for a matching file, ignoring case and decoding URL encoding
        encoded_filename = os.path.basename(filename)
        decoded_filename = urllib.parse.unquote(encoded_filename)
        
        # Normalize the name for case-insensitive search (Windows)
        target_lower = decoded_filename.lower()
        
        found_file = None
        for file in os.listdir(DOWNLOAD_DIR):
            if file.lower() == target_lower:
                found_file = file
                break
        
        if found_file:
            # Found a match, serve the actual file on disk
            return send_from_directory(DOWNLOAD_DIR, found_file, as_attachment=True)
        else:
            # If the search fails, log and return 404
            print(f"File not found on disk: Tried searching for {decoded_filename} in {DOWNLOAD_DIR}")
            return jsonify({'error': 'File not found on server.'}), 404
            
    except Exception as e:
        print(f"Error serving file: {e}")
        return jsonify({'error': 'An internal error occurred during file serving.'}), 500

if __name__ == '__main__':
    print(f"Starting Flask app on http://{HOST_IP}:{PORT}...")
    print(f"Download directory: {DOWNLOAD_DIR}")
    app.run(host=HOST_IP, port=PORT, debug=False)
