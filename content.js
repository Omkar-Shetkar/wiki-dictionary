function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

async function makeApiCall(url) {
  const startMark = `start_${url}`;
  const endMark = `end_${url}`;
  performance.mark(startMark);
  try {
    const response = await fetch(url);
    const data = await response.json();
    performance.mark(endMark);
    const measure = performance.measure(`${url}_duration`, startMark, endMark);
    return data;
  } catch (error) {
    console.error(`Error calling ${url}:`, error);
    performance.mark(endMark);
    performance.measure(`${url}_duration`, startMark, endMark);
    return null;
  }
}

async function getPronunciationUrl(word) {
  const parseApiUrl = `https://en.wiktionary.org/w/api.php?action=parse&page=${word}&prop=text&format=json`;
  try {
    const parseData = await makeApiCall(parseApiUrl);
    if (!parseData || parseData.error) {
      console.error("Error parsing Wiktionary page:", parseData.error ? parseData.error.info : "API call failed");
      return null;
    }

    const htmlText = parseData.parse.text["*"];
    const audioFileRegex = /<audio.*?src="([^"]*\.(ogg|mp3))"[^>]*>/gi;
    let match;
    let audioUrls = [];
    while ((match = audioFileRegex.exec(htmlText)) !== null) {
      audioUrls.push(match[1]);
    }

    if (audioUrls.length === 0) {
      return null;
    }

    const audioFileTitle = audioUrls[0].split('/').pop();
    const imageUrlApiUrl = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&titles=File:${audioFileTitle}&iiprop=url&format=json`;
    const imageUrlData = await makeApiCall(imageUrlApiUrl);
    if (!imageUrlData || imageUrlData.error) {
      console.error("Error getting image info:", imageUrlData.error ? imageUrlData.error.info : "API call failed");
      return null;
    }

    const pages = imageUrlData.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pages[pageId].missing) {
      console.error("Audio file not found.");
      return null;
    }

    return pages[pageId].imageinfo[0].url;
  } catch (error) {
    console.error("Error fetching pronunciation URL:", error);
    return null;
  }
}

async function showDefinition(selectedText, event) {
  const definitionApiUrl = `https://en.wiktionary.org/api/rest_v1/page/definition/${selectedText}`;
  try {
    const definitionData = await makeApiCall(definitionApiUrl);
    if (!definitionData) {
      console.error("Failed to fetch definition data.");
      return;
    }

    let englishDefinitions = [];
    if (definitionData.en) {
      for (const entry of definitionData.en) {
        if (entry.language === "English" && entry.definitions) {
          englishDefinitions.push(entry);
        }
      }
    }

    let meanings = "";
    if (englishDefinitions.length > 0) {
      let usedPartsOfSpeech = new Set();
      let definitionCount = 0;
      let definitionList = [];
      for (const entry of englishDefinitions) {
        if (usedPartsOfSpeech.has(entry.partOfSpeech)) {
          continue;
        }

        let partOfSpeech = entry.partOfSpeech;
        let defEntry;
        let definition;
        for (const item of entry.definitions) {
          definition = stripHtml(item.definition);
          if (definition !== "") {
            defEntry = item;
            break;
          }
        }

        if (!defEntry) {
          continue;
        }

        let example = "";
        if (defEntry.examples && defEntry.examples.length > 0) {
          example = `E.g: ${stripHtml(defEntry.examples[0])}`;
        }

        definitionList.push(
          `${partOfSpeech}: ${definition}${example}`
        );
        usedPartsOfSpeech.add(partOfSpeech);
        definitionCount++;
        if (definitionCount >= 2) {
          break;
        }
      }
      meanings = definitionList.join("<br><br>");
    } else {
      meanings = "No definitions found for this word.";
    }

    // Calculate max pop-up dimensions
    const maxWidth = window.innerWidth * 0.35;
    const maxHeight = window.innerHeight * 0.35;
    // Create and position the pop-up
    const popup = document.createElement("div");
    popup.id = "dictionary-popup";
    popup.style.position = "absolute";
    popup.style.top = `${event.pageY}px`;
    popup.style.left = `${event.pageX}px`;
    popup.style.backgroundColor = "rgba(144, 238, 144, 0.90)";
    popup.style.color = "black";
    popup.style.border = "1px solid #ccc";
    popup.style.borderRadius = "10px";
    popup.style.padding = "10px";
    popup.style.zIndex = 1000;
    popup.style.maxWidth = `${maxWidth}px`;
    popup.style.maxHeight = `${maxHeight}px`;
    popup.style.overflow = "auto";
    // Create content elements
    const title = document.createElement("strong");
    title.textContent = selectedText;
    const lineBreak = document.createElement("br");
    const meaningsDiv = document.createElement("div");
    meaningsDiv.innerHTML = meanings;

    popup.appendChild(title);
    popup.appendChild(lineBreak);
    popup.appendChild(meaningsDiv);

    // "Also See" Section
    const alsoSeeDiv = document.createElement("div");
    alsoSeeDiv.style.marginTop = "10px";
    alsoSeeDiv.style.borderTop = "1px solid #ccc";
    alsoSeeDiv.style.paddingTop = "5px";
    const alsoSeeTitle = document.createElement("div");
    alsoSeeTitle.style.fontWeight = "bold";
    alsoSeeTitle.textContent = "Also See:";
    alsoSeeDiv.appendChild(alsoSeeTitle);

    const alternateCaseWord = selectedText[0] === selectedText[0].toUpperCase() ?
      selectedText[0].toLowerCase() + selectedText.slice(1) :
      selectedText[0].toUpperCase() + selectedText.slice(1);

    const alternateCaseLink = document.createElement("a");
    alternateCaseLink.href = "#";
    alternateCaseLink.style.marginLeft = "5px";
    alternateCaseLink.textContent = alternateCaseWord;
    alternateCaseLink.addEventListener("click", (e) => {
      e.preventDefault();
      popup.remove(); // Remove the current popup
      showDefinition(alternateCaseWord, event); // Show definition for the alternate case word
    });
    alsoSeeDiv.appendChild(alternateCaseLink);
    popup.appendChild(alsoSeeDiv);

    document.body.appendChild(popup);

    // Start fetching pronunciation URL in the background
    getPronunciationUrl(selectedText).then(pronunciationUrl => {
      if (pronunciationUrl) {
        const audioIcon = document.createElement("img");
        audioIcon.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M3 9v6h4l5 5V4L7 9H3zm13.5 3c0 1.77-1.02 3.29-2.5 4.03v-8.07c1.48.73 2.5 2.25 2.5 4.04M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.28 7-8.77s-2.99-7.86-7-8.77z'%3E%3C/path%3E%3C/svg%3E";
        audioIcon.style.width = "20px";
        audioIcon.style.height = "20px";
        audioIcon.style.cursor = "pointer";
        audioIcon.style.marginLeft = "5px";
        audioIcon.addEventListener("click", (event) => {
          event.stopPropagation();
          new Audio(pronunciationUrl).play();
        });
        title.appendChild(audioIcon);
      }
    });

    // Remove pop-up on click outside
    document.addEventListener(
      "click",
      () => {
        if (popup) popup.remove();
      },
      { once: true }
    );
  } catch (error) {
    console.error("Error fetching data from Wiktionary:", error);
  }
}

document.addEventListener("dblclick", async (event) => {
  const startTime = performance.now();
  const ctrlDoubleClick = await browser.storage.sync.get({
    ctrlDoubleClick: false,
  });
  if (ctrlDoubleClick.ctrlDoubleClick && !(event.ctrlKey || event.metaKey)) {
    return;
  }

  const selectedText = window.getSelection().toString().trim();
  if (!selectedText) return;

  showDefinition(selectedText, event);

  const endTime = performance.now();
  const executionTime = endTime - startTime;
});
