unBoxit 📦

unBoxit is a seamless workflow integration for macOS that bridges the gap between the Box web interface, Slack, and your local Mac file system. It eliminates the tedious process of manually navigating through Finder to locate a file you are already viewing in your browser or a Slack channel.

With a single click, unBoxit takes a Box web link and instantly reveals the corresponding native file or folder in your local Box Drive via a custom boxlocal:// URL protocol.

🏗 Architecture & How It Works

The unBoxit ecosystem consists of three main components working together:

1. The Triggers (Browser Extension & Slack Bot)

Browser Extension (Chrome & Firefox): A lightweight extension that injects an "Open in Finder" button directly into the Box.com web interface. It parses the Box DOM's breadcrumb hierarchy to construct the exact file path and triggers a boxlocal:// link. (Automatically ignores root directories, file-specific preview pages, and the Box Developer Console).

Slack Bot Companion: Intercepts Box web links shared in Slack channels. Using the Box API (via CCG Auth), it resolves the underlying file structure and generates interactive "Open File" and "Open in Finder" buttons directly in the Slack chat.

2. The Protocol (boxlocal://)

Both triggers generate a URI using the boxlocal:// scheme, matching Box Drive's native local link formatting. This URL contains the relative path of the file or folder on the user's Box account.

3. The macOS Local Handler (handler.sh)

This is the core engine of the project. A lightweight macOS application bundle registers the boxlocal:// scheme with the operating system. When a link is clicked, it executes handler.sh, which performs the following:

Universal OS Check: Automatically detects if the user is running the modern macOS File Provider architecture (~/Library/CloudStorage/Box-Box) or the legacy Box Drive structure (~/Box).

Smart Trimming: If the web path includes parent folders structured differently than the local machine, the script intelligently trims the path until it finds a valid local match.

Deep Search Fallback: If the exact path cannot be resolved natively, the script falls back to a lightning-fast mdfind (Spotlight) or standard find command to locate the item locally.

Native Execution: Triggers the native macOS open (or open -R to reveal) command, instantly bringing the Finder window to the foreground.

4. Cloud Proxy & Offline Resilience

To ensure security and reliability, the local macOS app fetches the latest handler.sh execution logic from a Cloudflare Worker proxy (which securely holds the GitHub Personal Access Tokens). If the internet or GitHub is down, a wrapper script automatically falls back to the last successfully cached version of the script on the user's hard drive, preventing silent failures.

💻 System Requirements

OS: macOS 11.5 (Big Sur) or newer (required for the modern File Provider architecture).

Hardware: Apple Silicon (M-series) or Intel Mac.

Software: Box Drive must be installed and actively running. (Note: Legacy Box Sync is not supported).

🚀 Setup & Installation

(Note: These instructions are for enterprise/MDM deployment or local development)

Browser Extension

Download the extension source code. Or the actual extension [link to be added here later]

macOS Local App

Download or build the unBoxit.app bundle (created via AppleScript/Platypus).

Move unBoxit.app to the /Applications folder.

Open it once manually to register the boxlocal:// URL scheme with macOS Gatekeeper.

🛡 Security & Privacy

unBoxit is designed with zero-trust principles.

No API keys or sensitive credentials are saved on the user's local machine.

The Cloudflare Worker proxy completely abstracts GitHub authentication.

The local script only has permission to execute searches within the strict boundaries of the user's Box Drive directories.
