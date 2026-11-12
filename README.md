# unBoxit 📦

An open-source ecosystem designed to seamlessly bridge the gap between Box.com web links and your local macOS file system. unBoxit securely routes Box web URLs directly to your local Box Drive, saving you from navigating the web interface.

## System Architecture
unBoxit consists of three independent components that work together securely without requiring a dedicated database or user OAuth flows:

*   **Browser Extension:** Injects an "Open in Finder" button directly into the Box.com UI.
*   **macOS Handler:** A local protocol handler that catches `boxlocal://` links and safely opens them via Finder.
*   **Slack Bot:** Intercepts Box links shared in Slack and unfurls them with actionable native Finder buttons.

---

## 1. Browser Extension
*Routes clicks from the Box web app to your local machine.*

### Installation (Chrome)
1. Open Chrome and navigate to `chrome://extensions/`
2. Toggle **Developer mode** in the top right corner.
3. Click **Load unpacked** in the top left.
4. Select the `/browser-extension` folder from this repository.
5. Navigate to any Box.com folder to see the new "Open in Finder" button.

---

## 2. macOS Handler
*The secure engine that catches the protocol and translates it into physical file paths.*

### Compilation & Installation
Because macOS requires compiled applications to handle custom URL schemes, you will need to build the app locally using your Mac's native Script Editor.

1. Open the **Script Editor** app on your Mac (search via Spotlight).
2. Create a new document and paste the following AppleScript:
   ```applescript
   on open location this_URL
       do shell script "/bin/bash ~/path/to/your/repo/macos-handler/handler.sh '" & this_URL & "'"
   end open location
