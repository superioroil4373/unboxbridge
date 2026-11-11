/**
 * ==============================================================================
 * unBoxit - Browser Content Script
 * Parses Box.com DOM breadcrumbs to construct a local macOS path, injecting
 * an "Open in Finder" button into the Box web UI.
 * ==============================================================================
 */

let lastUrl = "";
let isUpdating = false;
let urlChangeTime = 0; // Tracks exactly when you navigated

// System menu items to ALWAYS exclude from the final path
const SYSTEM_EXCLUSIONS = [
    "Files", "All Files", "Home", "Notes", "Sign", "Automate",
    "Integrations", "Collections", "Dev Console", "Recents", "Trash"
];

function extractName(el) {
    if (!el) return "";
    const name = el.getAttribute('title') ||
                 el.getAttribute('aria-label') ||
                 el.innerText ||
                 el.textContent ||
                 "";
    return name.replace(/\u00A0/g, " ").trim();
}

function triggerNativeClick(element) {
    if (!element) return;
    const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    element.dispatchEvent(clickEvent);
}

async function injectFinderButton() {
    const currentUrl = window.location.pathname;

    // HARD EXCLUSION: Ignore root page (/folder/0), individual file pages (/file/), and the Dev Console (/developers/)
    if (currentUrl === "/folder/0" || currentUrl === "/" || currentUrl.endsWith("/folder/0") || currentUrl.includes("/file/") || currentUrl.includes("/developers/")) {
        const existingBtn = document.getElementById('open-in-finder-btn');
        if (existingBtn) existingBtn.remove();
        lastUrl = currentUrl;
        return;
    }

    let btn = document.getElementById('open-in-finder-btn');

    // --- DETECT NAVIGATION ---
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        urlChangeTime = Date.now(); // Start the 1.2s stabilization clock
        isUpdating = false; // Release any stuck locks
        
        if (btn) {
            btn.innerHTML = '⏳ Loading...';
            btn.style.opacity = '0.5';
            btn.dataset.ready = "false";
        }
        return; // Abort this cycle
    }

    // --- DOM STABILIZATION DELAY ---
    // Force the script to wait 1.2 seconds after a URL change.
    // This prevents building "Frankenstein" paths while Box's React engine is rendering.
    if (Date.now() - urlChangeTime < 1200) {
        return;
    }

    if (isUpdating) return;
    if (btn && btn.dataset.ready === "true") return;

    isUpdating = true;

    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'open-in-finder-btn';
        const header = document.querySelector('header') || document.body;
        header.appendChild(btn);
    }

    btn.innerHTML = '⏳ Updating...';
    btn.style.opacity = '0.5';
    btn.dataset.ready = "false";

    let cleanNames = [];
    let finalEllipsisTrigger = null;
    let finalMenuCaptured = false;

    // Outer Loop: Wait for React to fully construct the breadcrumb hierarchy
    for (let outerAttempt = 0; outerAttempt < 8; outerAttempt++) {
        let folderNames = [];

        const breadcrumbNav = document.querySelector('nav[aria-label="Breadcrumb"]') ||
                              document.querySelector('[data-resin-feature="breadcrumbs"]');

        if (breadcrumbNav) {
            // 1. Is the root "Files" link currently visible?
            const hasRootVisible = Array.from(breadcrumbNav.querySelectorAll('a, button, span')).some(el => {
                const text = (el.innerText || '').trim().toLowerCase();
                return text === "files" || text === "all files";
            });

            // 2. Is there a truncation menu button?
            const candidateNodes = Array.from(breadcrumbNav.querySelectorAll('button, [role="button"]'));
            const ellipsisTrigger = candidateNodes.find(el => {
                const text = (el.innerText || el.textContent || '').trim();
                const label = (el.getAttribute('aria-label') || '').toLowerCase();
                
                if (text.includes("New") || label.includes("create") || text.toLowerCase() === "files" || text.toLowerCase() === "all files") {
                    return false;
                }
                return true;
            });

            finalEllipsisTrigger = ellipsisTrigger;

            if (!hasRootVisible && !ellipsisTrigger) {
                await new Promise(resolve => setTimeout(resolve, 250));
                continue;
            }

            let menuCaptured = false;

            // 3. Click the trigger & Extract Hidden Folders 
            if (ellipsisTrigger) { 
                let hiddenNames = []; 
                for (let attempt = 0; attempt < 3; attempt++) { 
                    triggerNativeClick(ellipsisTrigger); 
                     
                    let activeMenu = null; 
                    for (let i = 0; i < 20; i++) { 
                        await new Promise(resolve => setTimeout(resolve, 30)); 
                        activeMenu = document.querySelector('[role="menu"]'); 
                        if (activeMenu) break; 
                    } 

                    if (activeMenu) { 
                        const hiddenItems = Array.from(activeMenu.querySelectorAll('a, [role="menuitem"]')); 
                        
                        // Grab EVERYTHING in the menu to prove the menu actually opened
                        const allExtractedNames = hiddenItems
                            .map(extractName) 
                            .filter(name => name && name !== "..." && name !== "…");
                        
                        // Filter out "Files" and other system exclusions for the final path
                        hiddenNames = allExtractedNames.filter(name => !SYSTEM_EXCLUSIONS.includes(name)); 
                         
                        triggerNativeClick(ellipsisTrigger); // Close menu 
                        
                        // THE FIX: As long as the menu contained SOMETHING, it was successful!
                        if (allExtractedNames.length > 0) { 
                            menuCaptured = true; 
                            break; 
                        } 
                    } 
                     
                    await new Promise(resolve => setTimeout(resolve, 150)); 
                } 

                if (hiddenNames.length > 0) { 
                    folderNames.push(...hiddenNames); 
                } 
            }

            finalMenuCaptured = menuCaptured;

            // 4. Read Visible Breadcrumb Links
            const visibleLinks = Array.from(breadcrumbNav.querySelectorAll('a'));
            visibleLinks.forEach(link => {
                const name = extractName(link);
                if (name && name !== "..." && name !== "…" && !SYSTEM_EXCLUSIONS.includes(name)) {
                    if (!folderNames.includes(name)) {
                        folderNames.push(name);
                    }
                }
            });

            // 5. Read Active H1 Folder
            const currentFolderElement = document.querySelector('h1');
            if (currentFolderElement) {
                const activeName = extractName(currentFolderElement);
                if (activeName && !SYSTEM_EXCLUSIONS.includes(activeName) && !folderNames.includes(activeName)) {
                    folderNames.push(activeName);
                }
            }

            cleanNames = folderNames.filter(name => name !== "" && !SYSTEM_EXCLUSIONS.includes(name));

            // SUCCESS VALIDATOR
            if (hasRootVisible || (ellipsisTrigger && menuCaptured)) {
                break;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 250));
    }

    // --- STRICT ABORT BLOCK ---
    if (finalEllipsisTrigger && !finalMenuCaptured) {
        isUpdating = false;
        return;
    }

    if (cleanNames.length === 0) {
        isUpdating = false;
        return;
    }

    const basePath = "~/Library/CloudStorage/Box-Box";
    const fullPath = basePath + "/" + cleanNames.map(encodeURIComponent).join("/");

    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        Open in Finder
    `;
    
    btn.style = 'display: flex; align-items: center; justify-content: center; margin-left: 15px; padding: 0 16px; height: 36px; background-color: #ae47f8; color: white; border: none; border-radius: 9999px; font-weight: 600; font-size: 14px; white-space: nowrap; cursor: pointer; z-index: 9999; opacity: 1; transition: opacity 0.2s ease;';
    btn.dataset.ready = "true";

    btn.onclick = (e) => {
        e.preventDefault();
        if (btn.dataset.ready === "true") {
            window.location.href = `boxlocal://${fullPath}`;
        }
    };

    isUpdating = false;
}

setInterval(injectFinderButton, 400);
