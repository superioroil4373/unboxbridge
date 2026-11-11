#!/bin/bash
# ==============================================================================
# unBoxit - Local macOS Handler
# Takes a URL scheme (e.g., unboxit://) and routes it to the local Box Drive app
# ==============================================================================

# 1. Fetch the raw URL from the argument
raw_input=$1

# 2. Strip the Box Drive native boxlocal:// prefix
prefix="boxlocal://"
raw_input="${raw_input#$prefix}"

# 3. Decode URL encoding (spaces, special characters)
decoded_path=$(perl -MURI::Escape -e 'print uri_unescape($ARGV[0]);' "$raw_input")

# 4. Check for the reveal action tag (used by Slack bot companions)
reveal_mode=false
if [[ "$decoded_path" == *"?action=reveal" ]]; then
    reveal_mode=true
    # Strip the tag from the path
    decoded_path="${decoded_path%?action=reveal}"
fi

# 5. Extract the relative path case-insensitively
# Looks for "box-box/" and keeps everything after it
rel_path=$(echo "$decoded_path" | perl -pe 's/.*?box-box\///i')

# 6. UNIVERSAL OS CHECK: Locate the Box Drive directory
if [ -d "$HOME/Library/CloudStorage/Box-Box" ]; then
    # Modern macOS File Provider architecture
    base_dir="$HOME/Library/CloudStorage/Box-Box"
elif [ -d "$HOME/Box" ]; then
    # Legacy Box Drive architecture
    base_dir="$HOME/Box"
else
    osascript -e 'display dialog "Box Drive does not appear to be installed or running." buttons {"OK"} default button 1 with icon stop with title "unBoxit"'
    exit 1
fi

target="$base_dir/$rel_path"

# 7. First Attempt: The Smart Trimming Loop 
# Adjusts for paths where parent folders might be structured slightly differently
while [ ! -e "$target" ] && [ -n "$rel_path" ]; do
    new_rel=$(echo "$rel_path" | cut -d"/" -f2-)
    if [ "$new_rel" = "$rel_path" ]; then
        break
    fi
    rel_path="$new_rel"
    target="$base_dir/$rel_path"
done

# 8. Second Attempt: Deep Search Fallback
# If folder is nested deeper on the local Mac than on the cloud account, search for the item name.
if [ ! -e "$target" ]; then
    target_name=$(basename "$decoded_path")
    
    # Fast Spotlight search first
    search_result=$(mdfind -onlyin "$base_dir" "kMDItemFSName == '$target_name'" 2>/dev/null | head -n 1)
    
    # Fall back to standard find if Spotlight indexing is incomplete
    if [ -z "$search_result" ]; then
        search_result=$(find "$base_dir" -maxdepth 6 -iname "$target_name" -print -quit 2>/dev/null)
    fi
    
    if [ -n "$search_result" ] && [ -e "$search_result" ]; then
        target="$search_result"
    fi
fi

# 9. Final Check: Abort if completely unfound
if [ ! -e "$target" ]; then
    osascript -e 'display dialog "Could not find this file on your local computer. Ensure Box Drive is synced." buttons {"OK"} default button 1 with icon stop with title "unBoxit"'
    exit 1
fi

# 10. Execute the native open command
if [ "$reveal_mode" = true ]; then
    if [ ! -d "$target" ]; then
        open -R "$target"  # Reveal file in Finder
    else
        open "$target"     # Open folder directly
    fi
else
    open "$target"         # Open file using default app or open folder
fi
