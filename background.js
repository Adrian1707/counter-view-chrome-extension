chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "counter-view-selection",
    title: "Get counter view (selected text)",
    contexts: ["selection"]
  });
  
  chrome.contextMenus.create({
    id: "counter-view-article",
    title: "Get counter view (full article)",
    contexts: ["page"]
  });
  
  chrome.contextMenus.create({
    id: "preview-extraction",
    title: "Preview extracted content",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "counter-view-selection" || info.menuItemId === "counter-view-article" || info.menuItemId === "preview-extraction") {
    // First, inject the content script to show the loading modal.
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content_script.js"]
    }, () => {
      
      // Handle different content extraction methods
      if (info.menuItemId === "counter-view-selection") {
        // Use selected text directly
        processWithLLM(info.selectionText, tab.id);
      } else if (info.menuItemId === "counter-view-article" || info.menuItemId === "preview-extraction") {
        // Extract article content automatically
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractArticleContent
        }, (results) => {
          console.log('Script execution results:', results);
          
          if (chrome.runtime.lastError) {
            console.error('Script execution error:', chrome.runtime.lastError);
            chrome.tabs.sendMessage(tab.id, {
              type: "show-counter-view",
              text: "Error: Could not access page content. Try selecting text manually."
            });
            return;
          }
          
          if (results && results[0] && results[0].result) {
            const extractedText = results[0].result;
            console.log(`Successfully extracted ${extractedText.length} characters`);
            
            if (info.menuItemId === "preview-extraction") {
              // Just show the extracted content for preview
              chrome.tabs.sendMessage(tab.id, {
                type: "show-counter-view",
                text: `**Extracted Content Preview (${extractedText.length} characters):**\n\n${extractedText.substring(0, 2000)}${extractedText.length > 2000 ? '\n\n...(truncated)' : ''}`
              });
            } else {
              // Process with LLM
              processWithLLM(extractedText, tab.id);
            }
          } else {
            console.log('No content extracted, trying fallback...');
            // Try a simpler fallback approach
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                // Ultra-simple fallback - just get all text
                const text = document.body.innerText || document.body.textContent || '';
                return text.length > 50 ? text : null;
              }
            }, (fallbackResults) => {
              if (fallbackResults && fallbackResults[0] && fallbackResults[0].result) {
                console.log('Fallback extraction successful');
                const fallbackText = fallbackResults[0].result;
                
                if (info.menuItemId === "preview-extraction") {
                  chrome.tabs.sendMessage(tab.id, {
                    type: "show-counter-view",
                    text: `**Extracted Content Preview (${fallbackText.length} characters - fallback method):**\n\n${fallbackText.substring(0, 2000)}${fallbackText.length > 2000 ? '\n\n...(truncated)' : ''}`
                  });
                } else {
                  processWithLLM(fallbackText, tab.id);
                }
              } else {
                chrome.tabs.sendMessage(tab.id, {
                  type: "show-counter-view",
                  text: "Error: Could not extract article content. The page might not have readable text content, or it may be dynamically loaded. Try selecting text manually."
                });
              }
            });
          }
        });
      }
    });
  }
});

// Function to extract article content from the page
function extractArticleContent() {
  console.log('Starting article extraction...');
  
  // Strategy 1: Look for semantic HTML5 article elements and common content selectors
  const primarySelectors = [
    'article',
    '[role="main"]', 
    'main',
    '.post-content',
    '.entry-content', 
    '.article-content',
    '.article-body',
    '.post-body',
    '.story-body',
    '.content-body',
    '.article-text',
    '.post-text',
    '.story-content',
    '#content',
    '.content',
    '.text',
    '.body-text'
  ];
  
  for (const selector of primarySelectors) {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`Found element with selector: ${selector}`);
      const text = getSimpleText(element);
      if (text && text.length > 100) { // Much lower threshold
        console.log(`Extracted ${text.length} characters from ${selector}`);
        return text;
      }
    }
  }
  
  // Strategy 2: Find all paragraphs and combine them
  const paragraphs = document.querySelectorAll('p');
  if (paragraphs.length > 0) {
    console.log(`Found ${paragraphs.length} paragraphs`);
    const paragraphTexts = Array.from(paragraphs)
      .map(p => p.innerText.trim())
      .filter(text => text.length > 20) // Filter out very short paragraphs
      .filter(text => !isLikelyNavigation(text));
    
    if (paragraphTexts.length > 0) {
      const combinedText = paragraphTexts.join('\n\n');
      if (combinedText.length > 100) {
        console.log(`Extracted ${combinedText.length} characters from paragraphs`);
        return combinedText;
      }
    }
  }
  
  // Strategy 3: Find the container with the most text content
  const contentContainers = document.querySelectorAll('div, section, main, article');
  let bestContainer = null;
  let bestLength = 0;
  
  contentContainers.forEach(container => {
    const text = container.innerText || container.textContent || '';
    if (text.length > bestLength && text.length > 200) {
      bestLength = text.length;
      bestContainer = container;
    }
  });
  
  if (bestContainer) {
    console.log(`Found best container with ${bestLength} characters`);
    const text = getSimpleText(bestContainer);
    if (text && text.length > 100) {
      return text;
    }
  }
  
  // Strategy 4: Look for any substantial text blocks
  const allElements = document.querySelectorAll('div, p, span, section, article');
  const textBlocks = [];
  
  allElements.forEach(element => {
    const text = element.innerText || element.textContent || '';
    if (text.length > 50 && text.length < 10000) { // Reasonable size range
      textBlocks.push({
        text: text.trim(),
        length: text.length
      });
    }
  });
  
  if (textBlocks.length > 0) {
    // Sort by length and take the longest
    textBlocks.sort((a, b) => b.length - a.length);
    const longestText = textBlocks[0].text;
    if (longestText.length > 100) {
      console.log(`Extracted ${longestText.length} characters from longest text block`);
      return longestText;
    }
  }
  
  // Strategy 5: Ultimate fallback - get all visible text
  const bodyText = document.body.innerText || document.body.textContent || '';
  if (bodyText.length > 100) {
    console.log(`Fallback: extracted ${bodyText.length} characters from body`);
    return bodyText;
  }
  
  console.log('No content found');
  return null;
}

// Simple helper function to get text from an element
function getSimpleText(element) {
  if (!element) return null;
  
  // Get the text content
  let text = element.innerText || element.textContent || '';
  
  // Basic cleanup - remove excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// Simple helper to detect likely navigation text
function isLikelyNavigation(text) {
  const navPatterns = [
    /^(Home|Menu|Navigation|Share|Tweet|Like|Follow|Subscribe|Login|Register|Sign up|Sign in)$/i,
    /^\d+\s+(comments?|shares?|likes?|views?)$/i,
    /^(Next|Previous|Back|Continue|Read more)$/i,
    /^(Facebook|Twitter|Instagram|LinkedIn|YouTube)$/i
  ];
  
  return navPatterns.some(pattern => pattern.test(text.trim()));
}

function processWithLLM(content, tabId) {
  const apiKey = "";
  const apiUrl = "https://api.openai.com/v1/chat/completions";

  const systemPrompt = `
  You are a skilled critical thinker and devil's advocate whose primary role is to provide thoughtful counterpoints and alternative perspectives to any text or article presented to you. Your goal is to help users think more deeply by exposing blind spots, biases, and unexplored angles in the source material.
  Core Responsibilities
  Identify and analyze:

  Logical fallacies - Point out flawed reasoning patterns (ad hominem, straw man, false dichotomy, hasty generalization, etc.)
  Cognitive biases - Highlight confirmation bias, survivorship bias, availability heuristic, anchoring bias, etc.
  Unstated assumptions - Surface implicit beliefs or premises the author takes for granted
  Missing perspectives - Identify viewpoints, stakeholders, or contexts the author failed to consider
  Contradictions - Note internal inconsistencies or statements that conflict with each other
  Selective evidence - Highlight cherry-picking, omitted data, or ignored counterexamples
  Causal confusion - Distinguish between correlation and causation, identify oversimplified cause-effect relationships
  Scale and scope issues - Question whether conclusions apply beyond the specific context examined

  Analytical Framework
  For each piece of content, systematically examine:

  Author's Position & Framing

  What is the author's clear thesis or main argument?
  How do they frame the issue? What framing alternatives exist?
  What emotional language or loaded terms are used?

  Evidence Quality

  How strong is the supporting evidence?
  What evidence is missing or dismissed?
  Are sources credible and recent?
  Is the sample size or data set adequate?

  Alternative Explanations

  What other theories could explain the same phenomena?
  What competing interpretations are possible?
  How might different disciplines approach this topic?

  Stakeholder Analysis

  Whose voices are amplified vs. silenced?
  Who benefits from this perspective?
  What groups might disagree and why?

  Broader Context

  What historical, cultural, or systemic factors are overlooked?
  How might this issue look different in other contexts or time periods?
  What long-term implications are unconsidered?

  Response Guidelines

  Be intellectually rigorous but not dismissive - acknowledge the author's valid points while exploring limitations
  Provide specific examples rather than vague criticisms
  Suggest concrete alternative perspectives with brief rationales
  Ask probing questions that encourage deeper thinking
  Maintain intellectual humility - acknowledge when counterpoints have their own limitations
  Focus on the strongest possible counterarguments rather than nitpicking minor issues
  Be constructive - aim to enhance understanding rather than simply tear down

  Sample Response Structure

  Brief acknowledgment of the author's main argument and any strong points
  Primary counterpoints organized by type (logical, evidential, perspective-based)
  Alternative frameworks for understanding the issue
  Questions for further consideration
  Synthesis noting where multiple perspectives might coexist or complement each other

  Key Reminders

  Challenge ideas, not people - focus on arguments rather than attacking the author's character
  Consider steelmanning opposing views - present the strongest possible version of alternative positions
  Recognize that most complex issues have merit on multiple sides
  Distinguish between factual errors and legitimate differences in values or priorities
  Remember that your goal is to stimulate critical thinking, not to be contrarian for its own sake

  Your ultimate objective is to serve as an intellectual sparring partner that helps users develop more nuanced, well-rounded perspectives on complex topics.
`

  fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: content
        }
      ]
    })
  })
  .then(response => response.json())
  .then(data => {
    chrome.tabs.sendMessage(tabId, {
      type: "show-counter-view",
      text: data.choices[0].message.content
    });
  })
  .catch(error => {
    console.error("Error calling LLM API:", error);
    chrome.tabs.sendMessage(tabId, {
      type: "show-counter-view",
      text: "Error: Could not get counter view."
    });
  });
}