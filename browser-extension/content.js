/**
 * ==============================================================================
 * unBoxit - Browser Content Script (Maximum Security Edition)
 * ==============================================================================
 */

let lastUrl = "";
let isUpdating = false;
let urlChangeTime = 0; 
const EXTENSION_ID = "unBoxit-native-mount-x8f2a"; // Obscured ID to prevent DOM Clobbering

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

function buildButtonDOM(btn) {
    btn.textContent = ''; 
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.5");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.style.marginRight = "8px";

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z");
    svg.appendChild(path);
    btn.appendChild(svg);
    btn.appendChild(document.createTextNode("Open in Finder"));
}

// SECURITY PATCH 3: Safe Protocol Execution via hidden Iframe
function triggerCustomProtocol(url) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 1000); // Cleanup after trigger
}

async function injectFinderButton() {
    const currentUrl = window.location.pathname; // Capture URL state for race-condition checking

    if (currentUrl === "/folder/0" || currentUrl === "/" || currentUrl.endsWith("/folder/0") || currentUrl.includes("/file/") || currentUrl.includes("/developers/")) {
        const existingBtn = document.getElementById(EXTENSION_ID);
        if (existingBtn) existingBtn.remove();
        lastUrl = currentUrl;
        return;
    }

    let btn = document.getElementById(EXTENSION_ID);

    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        urlChangeTime = Date.now(); 
        isUpdating = false; 
        
        if (btn) {
            btn.textContent = '⏳ Loading...';
            btn.style.opacity = '0.5';
            btn.dataset.ready = "false";
        }
        return; 
    }

    if (Date.now() - urlChangeTime < 1200) return;
    if (isUpdating) return;
    if (btn && btn.dataset.ready === "true") return;

    isUpdating = true;

    if (!btn) {
        btn = document.createElement('button');
        btn.id = EXTENSION_ID; // SECURITY PATCH 2: Hardened DOM ID
        const header = document.querySelector('header') || document.body;
        header.appendChild(btn);
    }

    btn.textContent = '⏳ Updating...';
    btn.style.opacity = '0.5';
    btn.dataset.ready = "false";

    let cleanNames = [];
    let finalEllipsisTrigger = null;
    let finalMenuCaptured = false;

    for (let outerAttempt = 0; outerAttempt < 8; outerAttempt++) {
        // SECURITY PATCH 1: Race Condition Abort
        if (window.location.pathname !== currentUrl) {
            isUpdating = false;
            return;
        }

        let folderNames = [];
        const breadcrumbNav = document.querySelector('nav[aria-label="Breadcrumb"]') || document.querySelector('[data-resin-feature="breadcrumbs"]');

        if (breadcrumbNav) {
            const hasRootVisible = Array.from(breadcrumbNav.querySelectorAll('a, button, span')).some(el => {
                const text = (el.innerText || '').trim().toLowerCase();
                return text === "files" || text === "all files";
            });

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
                        const allExtractedNames = hiddenItems
                            .map(extractName) 
                            .filter(name => name && name !== "..." && name !== "…");
                        
                        hiddenNames = allExtractedNames.filter(name => !SYSTEM_EXCLUSIONS.includes(name)); 
                        triggerNativeClick(ellipsisTrigger); 
                        
                        if (allExtractedNames.length > 0) { 
                            menuCaptured = true; 
                            break; 
                        } 
                    } 
                    await new Promise(resolve => setTimeout(resolve, 150)); 
                } 
                if (hiddenNames.length > 0) folderNames.push(...hiddenNames); 
            }

            finalMenuCaptured = menuCaptured;

            const visibleLinks = Array.from(breadcrumbNav.querySelectorAll('a'));
            visibleLinks.forEach(link => {
                const name = extractName(link);
                if (name && name !== "..." && name !== "…" && !SYSTEM_EXCLUSIONS.includes(name)) {
                    if (!folderNames.includes(name)) folderNames.push(name);
                }
            });

            const currentFolderElement = document.querySelector('h1');
            if (currentFolderElement) {
                const activeName = extractName(currentFolderElement);
                if (activeName && !SYSTEM_EXCLUSIONS.includes(activeName) && !folderNames.includes(activeName)) {
                    folderNames.push(activeName);
                }
            }

            cleanNames = folderNames.filter(name => name !== "" && !SYSTEM_EXCLUSIONS.includes(name));

            if (hasRootVisible || (ellipsisTrigger && menuCaptured)) break;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
    }

    // Final Race Condition Check before rendering the button
    if (window.location.pathname !== currentUrl) {
        isUpdating = false;
        return;
    }

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

    buildButtonDOM(btn);
    
    btn.style = 'display: flex; align-items: center; justify-content: center; margin-left: 15px; padding: 0 16px; height: 36px; background-color: #ae47f8; color: white; border: none; border-radius: 9999px; font-weight: 600; font-size: 14px; white-space: nowrap; cursor: pointer; z-index: 9999; opacity: 1; transition: opacity 0.2s ease;';
    btn.dataset.ready = "true";

    btn.onclick = (e) => {
        e.preventDefault();
        if (btn.dataset.ready === "true") {
            triggerCustomProtocol(`boxlocal://${fullPath}`); // Trigger safely
        }
    };

    isUpdating = false;
}

const observer = new MutationObserver(() => {
    const btn = document.getElementById(EXTENSION_ID);
    if (window.location.pathname !== lastUrl || !btn || btn.dataset.ready !== "true") {
        injectFinderButton();
    }
});

observer.observe(document.body, { childList: true, subtree: true });
injectFinderButton();
