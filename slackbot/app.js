/**
 * ==============================================================================
 * unBoxit - Slack Bot Companion
 * ==============================================================================
 */

require('dotenv').config();
const { App } = require('@slack/bolt');
const { BoxClient } = require('box-node-sdk');
const { BoxCcgAuth, CcgConfig } = require('box-node-sdk/box'); 

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

const ccgConfig = new CcgConfig({
  enterpriseId: process.env.BOX_ENTERPRISE_ID,
  clientId: process.env.BOX_CLIENT_ID,
  clientSecret: process.env.BOX_CLIENT_SECRET,
});
const ccgAuth = new BoxCcgAuth({ config: ccgConfig });
const boxClient = new BoxClient({ auth: ccgAuth });

app.action('open_file_click', async ({ ack }) => {
  await ack();
});

app.action('open_in_finder_click', async ({ ack }) => {
  await ack();
});

app.message(/box\.com\/(folder|file|s)\/([a-zA-Z0-9_]+)/, async ({ message, context, say }) => {
  try {
    const itemType = context.matches[1]; 
    const itemId = context.matches[2]; 

    // SECURITY PATCH 1: Anti-Smuggling. 
    // Reconstruct the safe URL only from the matched Box parameters.
    const rawInput = context.matches.input;
    let cleanUrl = `https://box.com/${itemType}/${itemId}`;
    
    const sharedSecretMatch = rawInput.match(/\?s=([a-zA-Z0-9_]+)/);
    if (sharedSecretMatch) {
      cleanUrl += `?s=${sharedSecretMatch[1]}`;
    }

    const apiOptions = {
      headers: { extraHeaders: { 'boxapi': `shared_link=${cleanUrl}` } }
    };

    let itemData;
    let itemName;

    if (itemType === 's') {
      try {
        itemData = await boxClient.sharedLinksFolders.findFolderForSharedLink({}, apiOptions);
        itemName = itemData.name;
        itemType = 'folder';
      } catch (folderError) {
        itemData = await boxClient.sharedLinksFiles.findFileForSharedLink({}, apiOptions);
        itemName = itemData.name;
        itemType = 'file';
      }
    } else if (itemType === 'folder') {
      itemData = await boxClient.folders.getFolderById(itemId, apiOptions);
      itemName = itemData.name;
    } else if (itemType === 'file') {
      itemData = await boxClient.files.getFileById(itemId, apiOptions);
      itemName = itemData.name;
    }

    // SECURITY PATCH 2: Slack UI Injection Prevention
    // Strips control characters (<, >, !, @) from the Box item name so Slack won't parse malicious markdown
    const safeItemName = itemName.replace(/[<>!@]/g, "");

    const pathEntries = itemData.pathCollection ? itemData.pathCollection.entries : (itemData.path_collection ? itemData.path_collection.entries : []);
    let folderNames = pathEntries
      .map(entry => entry.name.replace(/[<>!@]/g, ""))
      .filter(name => name !== 'All Files' && name !== 'Files');

    const basePath = "~/Library/CloudStorage/Box-Box";
    const exactFolderNames = [...folderNames, safeItemName];
    const fullPath = basePath + "/" + exactFolderNames.map(encodeURIComponent).join("/");
    const boxLocalUrlTarget = `boxlocal://${fullPath}`;

    let buttonElements = [];

    if (itemType === 'file') {
      buttonElements.push({
        type: "button",
        text: { type: "plain_text", emoji: true, text: "📄 Open File" },
        style: "primary",
        url: boxLocalUrlTarget, 
        action_id: "open_file_click"
      });

      buttonElements.push({
        type: "button",
        text: { type: "plain_text", emoji: true, text: "📂 Open Folder in Finder" },
        url: `${boxLocalUrlTarget}?action=reveal`, 
        action_id: "open_in_finder_click"
      });
    } else {
      buttonElements.push({
        type: "button",
        text: { type: "plain_text", emoji: true, text: "📂 Open in Finder" },
        style: "primary",
        url: boxLocalUrlTarget, 
        action_id: "open_in_finder_click"
      });
    }

    await say({
      text: `I found a Box link for ${safeItemName}!`, 
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `I found a Box link for *${safeItemName}*! Do you want to open it locally?`
          }
        },
        {
          type: "actions",
          elements: buttonElements
        }
      ]
    });

  } catch (error) {
    console.error("Error processing Box link:", error);
    
    const status = error.statusCode || (error.responseInfo && error.responseInfo.statusCode);

    if (status === 404 || status === 403) {
      await say({
        text: "I intercepted that Box link, but I don't have permission to access it!",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "🔒 *I can't access this Box link.*\nTo open this in Finder, please share a **Shared Link** (with a `?s=` key) or invite the bot user to this folder."
            }
          }
        ]
      });
    }
  }
});

(async () => {
  await app.start();
  console.log('⚡️ unBoxit Slack Bot is running!');
})();
