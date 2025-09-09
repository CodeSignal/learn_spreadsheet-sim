const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const { execSync } = require('child_process');

dotenv.config();

const originalUrl = process.env.ORIGINAL_SPREADSHEET_URL;

function generateRandomTag(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function updateEnvVariable(key, value) {
    const envPath = path.resolve(__dirname, '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
        envContent += `\n${key}=${value}`;
    }

    fs.writeFileSync(envPath, envContent);
}

function writeTagToEnv(tag) {
    if (!process.env.GENERATED_TAG) {
        updateEnvVariable('GENERATED_TAG', tag);
    }
}

function getOrCreateTag() {
    if (process.env.GENERATED_TAG) {
        return process.env.GENERATED_TAG;
    }

    const newTag = generateRandomTag();
    writeTagToEnv(newTag);
    return newTag;
}

function extractSpreadsheetId(url) {
    try {
        const parsed = new URL(url);
        const match = parsed.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/);
        console.log("match = ", match);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

function generateDocumentCopy() {
    const CURL_ENDPOINT = process.env.COPY_ENDPOINT || 'http://146.190.40.43:3000/getSpreadsheet';
    const tag = getOrCreateTag();

    let newUrl = null;
    try {
        console.log('creating a copy of the spreadsheet...');
        const response = execSync(`curl -s -X POST ${CURL_ENDPOINT} \
-H "Content-Type: application/json" \
-d '{"spreadsheetUrl":"${originalUrl}", "lifetimeInHours": 12, "tag": "${tag}"}'`);

        const data = JSON.parse(response.toString());
        newUrl = data.cloneUrl || null;
        console.log('new url is ', newUrl);

        if (newUrl) {
            const newSheetId = extractSpreadsheetId(newUrl);
            if (newSheetId) {
                updateEnvVariable('GOOGLE_SHEET_ID', newSheetId);
                console.log(`✅ GOOGLE_SHEET_ID updated to ${newSheetId}`);
            }
        }
    } catch (err) {
        console.error('Failed to fetch spreadsheet:', err);
    }

    return newUrl;
}

async function setRedirect(url) {
    try {
        await axios.post('http://localhost:3000/setRedirect', { url });
        console.log('✅ Redirect URL set successfully');
    } catch (err) {
        console.error('❌ Failed to set redirect URL:', err.message);
    }
}

// Run it and launch proxy
if (require.main === module) {
    const newUrl = generateDocumentCopy();
    if (newUrl) {
        setRedirect(newUrl);  // Set proxy server redirection url
    } else {
        console.error('No URL to redirect to.');
    }
}
