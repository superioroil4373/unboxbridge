# unBoxit <img src="browser-extension/Icon.png" alt="unBoxit Icon" height="40">

An open-source ecosystem designed to seamlessly bridge the gap between Box.com web links and your local macOS file system. unBoxit securely routes Box web URLs directly to your local Box Drive, opening them in finder and saving you from navigating the folder tree locally.

## Prerequisites & System Requirements
*   **Operating System:** macOS (the local handler relies on AppleScript, Spotlight, and the native `open` command).
*   **Cloud Storage:** The [Box Drive](https://www.box.com/drive) desktop application must be installed and running.
*   **Browser:** Google Chrome, Microsoft Edge, or Mozilla Firefox.
*   **Slack Bot:** Node.js v20 or higher.

## System Architecture
unBoxit consists of three independent components that work together securely without requiring a dedicated database or user OAuth flows:

*   **Browser Extension:** Injects an "Open in Finder" button directly into the Box.com folder UI.
*   **macOS Handler:** A local protocol handler that catches `boxlocal://` links and safely opens them via Finder.
*   **Slack Bot:** Intercepts Box links shared in Slack and unfurls them with actionable native Slack buttons.

---

## 1. Browser Extension
*Routes clicks from the Box web app to your local machine.*

### Installation (Chrome & Firefox)
I have not tested this in other browsers. To use this extension, you will need to load it directly from the source code.

**For Google Chrome:**
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top right corner.
3. Click **Load unpacked** in the top left.
4. Select the `/browser-extension` folder from this repository.

**For Mozilla Firefox:**
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click the **Load Temporary Add-on...** button.
3. Navigate to the `/browser-extension` folder and select the `manifest.json` file.

**Usage:**
Once installed, navigate to any Box.com folder to see the new "Open in Finder" button.

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
```

3. Go to **File > Export**.
4. Set the File Format to **Application** and check the **Stay open after run handler** box.
5. Name it `unBoxit.app` and save it to your `/Applications` folder.
6. Right-click `unBoxit.app` in Finder, select **Show Package Contents**, and open `Contents/Info.plist` in a text editor.
7. Add the URL scheme registration right before the final `</dict>` tag:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>unBoxit Local Handler</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>boxlocal</string>
        </array>
    </dict>
</array>
```

8. Run the app once to register the `boxlocal://` protocol with your Mac.

---

## 3. Slack Bot Companion
*Unfurls Box links in your workspace with native local application triggers.*

### Setup
1. Create a new Slack app at [api.slack.com](https://api.slack.com/) and enable Socket Mode.
2. In the Box Developer Console, create a new Custom App with **Client Credentials Grant (CCG)** authentication.
3. Ensure the Box bot is **not** scoped with "Read all files and folders" to prevent IDOR data leaks.

### Deployment
1. Navigate to the `/slack-bot` directory in your terminal.
2. Run `npm install` to build the dependencies.
3. Rename `.env.example` to `.env` and fill in your specific Slack and Box API credentials.
4. Run `npm start` to boot the bot.
