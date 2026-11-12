#!/bin/bash
# ==============================================================================
# unBoxit - Local macOS Handler (Pen-Tested Edition)
# Takes a URL scheme (e.g., boxlocal://) and routes it to the local Box Drive app
# ==============================================================================

# 1. Fetch the raw URL
raw_input=$1

# 2. Strip the Box Drive native prefix
prefix="boxlocal://"
raw_input="${raw_input#$prefix}"

# 3. Decode URL encoding
decoded_path=$(perl -MURI::Escape -e 'print uri_unescape($ARGV[0]);' "$raw_input")

# --- SECURITY PATCH 1: String Traversal Prevention ---
if [[ "$decoded_path" == *".."* ]]; then
    osascript -e 'display dialog "Security Alert: Invalid path traversal detected." buttons {"OK"} default button 1 with icon stop with title "unBoxit"'
    exit 1
fi

# 4. Check for the reveal action tag
reveal_mode=false
if [[ "$decoded_path" == *"?action=reveal" ]]; then
    reveal_mode=true
    decoded_path="${decoded_path%?action=reveal}"
fi

# 5. Extract the relative path case-insensitively
# SECURITY PATCH 2: Using printf to avoid flag swallowing if a folder is named "-e"
rel_path=$(printf "%s" "$decoded_path" | perl -pe 's/.*?(?:\/|%2F)box-box(?:\/|%2F)//i')

# 6. UNIVERSAL OS CHECK: Locate the Box Drive directory
if [ -d "$HOME/Library/CloudStorage/Box-Box" ]; then
    base_dir="$HOME/Library/CloudStorage/Box-Box"
elif [ -d "$HOME/Box" ]; then
    base_dir="$HOME/Box"
else
    osascript -e 'display dialog "Box Drive does not appear to be installed or running." buttons {"OK"} default button 1 with icon stop with title "unBoxit"'
    exit 1
fi

target="$base_dir/$rel_path"

# 7. First Attempt: The Smart Trimming Loop 
while [ ! -e "$target" ] && [ -n "$rel_path" ]; do
    new_rel=$(printf "%s" "$rel_path" | cut -d"/" -f2-)
    if [ "$new_rel" = "$rel_path" ]; then
        break
    fi
    rel_path="$new_rel"
    target="$base_dir/$rel_path"
done

# 8. Second Attempt: Deep Search Fallback
if [ ! -e "$target" ]; then
    target_name=$(basename "$decoded_path")
    safe_target_name="${target_name//\"/\\\"}"
    
    search_result=$(mdfind -onlyin "$base_dir" 'kMDItemFSName == "'"$safe_target_name"'"' 2>/dev/null | head -n 1)
    
    if [ -z "$search_result" ]; then
        search_result=$(find "$base_dir" -maxdepth 6 -iname "$target_name" -print -quit 2>/dev/null)
    fi
    
    if [ -n "$search_result" ] && [ -e "$search_result" ]; then
        target="$search_result"
    fi
fi

if [ ! -e "$target" ]; then
    osascript -e 'display dialog "Could not find this file on your local computer. Ensure Box Drive is synced." buttons {"OK"} default button 1 with icon stop with title "unBoxit"'
    exit 1
fi

# --- SECURITY PATCH 3: Symlink Dereferencing & Canonical Path Validation ---
# Resolves the absolute path to prevent symlinks from escaping the Box directory
actual_path=$(python3 -c "import os, sys; print(os.path.realpath(sys.argv[1]))" "$target" 2>/dev/null)

if [[ "$actual_path" != "$base_dir"* ]]; then
    osascript -e 'display dialog "Security Alert: Target resolves outside the allowed Box directory." buttons {"OK"} default button 1 with icon stop with title "unBoxit"'
    exit 1
fi

# --- SECURITY PATCH 4: RCE / Executable Quarantine ---
# Force reveal mode if the target is an application, script, or package to prevent accidental execution
if [[ "$target" == *.app* || "$target" == *.command || "$target" == *.pkg || "$target" == *.sh || "$target" == *.scpt ]]; then
    reveal_mode=true
fi

# 10. Execute the native open command safely
if [ "$reveal_mode" = true ]; then
    if [ ! -d "$target" ]; then
        open -R "$target"  
    else
        open "$target"     
    fi
else
    open "$target"         
fi
