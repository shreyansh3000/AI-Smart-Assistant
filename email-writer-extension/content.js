console.log("Email Writer Extension - Content Script");

function createAIButton() {
    const button = document.createElement('div');
    button.className = 'T-I J-J5-Ji ao0 T-I-atl L3';
    button.style.marginRight = '8px';
    button.innerHTML = 'AI Reply';
    button.setAttribute('role', 'button');
    button.setAttribute('data-tooltip', 'Generate AI reply');
    return button;
}

function findComposeToolbar() {
    const selectors = ['.btC', '.aDh', '[role="toolbar"]', '.gU.Up'];
    for (const selector of selectors) {
        const toolbar = document.querySelector(selector);
        if (toolbar) {
            return toolbar;
        }
    }
    return null;
}

function getEmailContent() {
    const selectors = ['.h7', '.a3s.aiL', '.gmail_quote', '[role="presentation"]'];
    for (const selector of selectors) {
        const content = document.querySelector(selector);
        if (content) {
            // Extract plain text without extra spaces
            const extractedText = content.textContent.replace(/\s+/g, ' ').trim();
            console.log("Extracted Email Content:", extractedText);
            return extractedText;
        }
    }
    console.error("No email content found!");
    return '';
}

function injectButton() {
    if (document.querySelector('.ai-reply-button')) return; // Prevent duplicate buttons

    const toolbar = findComposeToolbar();
    if (!toolbar) {
        console.log("Toolbar not found");
        return;
    }

    console.log("Toolbar found, creating AI button");
    const button = createAIButton();
    button.classList.add('ai-reply-button');

    button.addEventListener('click', async () => {
        try {
            button.innerHTML = 'Generating...';
            button.disabled = true;

            const emailContent = getEmailContent();
            if (!emailContent) {
                throw new Error("Email content is empty!");
            }

            // API Call with retry logic
            async function fetchWithRetry(attempt = 1) {
                try {
                    const response = await fetch('https://ai-reply-generator1-production.up.railway.app/api/email/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ emailContent, tone: "professional" })
                    });
                    console.log("Status:", response.status);
                    if (!response.ok) {
                        throw new Error(`Attempt ${attempt}: API request failed with status ${response.status}`);
                    }

                    return await response.text();
                } catch (error) {
                    console.error("Error on attempt", attempt, error);
                    if (attempt < 2) {
                        console.log("Retrying API request...");
                        return await fetchWithRetry(attempt + 1);
                    } else {
                        throw new Error("API request failed after retry");
                    }
                }
            }

            const generatedReply = await fetchWithRetry();
            console.log("Generated Reply from API:", generatedReply);

            // Insert the generated reply into the email compose box
            const composeBox = document.querySelector('[role="textbox"][g_editable="true"]');
            if (composeBox) {
                composeBox.focus();
                document.execCommand('insertText', false, generatedReply);

                // Fallback in case execCommand doesn't work
                if (composeBox.innerHTML.trim() === '') {
                    composeBox.innerHTML = generatedReply;
                }
            } else {
                console.error("Compose Box was not found");
            }
        } catch (error) {
            console.error(error);
            alert("Failed to generate a reply");
        } finally {
            button.innerHTML = 'AI Reply';
            button.disabled = false;
        }
    });

    toolbar.insertBefore(button, toolbar.firstChild);
}

// MutationObserver to detect Gmail compose box
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        const addedNodes = Array.from(mutation.addedNodes);
        const hasComposeElements = addedNodes.some(node =>
            node.nodeType === Node.ELEMENT_NODE &&
            (node.matches('.aDh , .btC ,[role="dialog"]') || node.querySelector('.aDh , .btC ,[role="dialog"]'))
        );

        if (hasComposeElements) {
            console.log("Compose Window Detected");
            setTimeout(injectButton, 1000); // Allows Gmail UI to load
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
