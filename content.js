function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

async function getPronunciationUrl(word) {
  const parseApiUrl = `https://en.wiktionary.org/w/api.php?action=parse&page=${word}&prop=text&format=json`;

  try {
    const response = await fetch(parseApiUrl);
    const parseData = await response.json();

    if (parseData.error) {
      console.error("Error parsing Wiktionary page:", parseData.error.info);
      return null;
    }

    const htmlText = parseData.parse.text["*"];
    const audioFileRegex = /<source[^>]*src="([^"]*\.(ogg|mp3))"[^>]*>/gi;
    let match;
    let audioUrls = [];

    while ((match = audioFileRegex.exec(htmlText)) !== null) {
      audioUrls.push(match[1]);
    }

    if (audioUrls.length === 0) {
      return null;
    }

    // For simplicity, let's use the first audio URL found
    const audioFileTitle = audioUrls[0].split('/').pop();
    const imageUrlApiUrl = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&titles=File:${audioFileTitle}&iiprop=url&format=json`;

    const imageUrlResponse = await fetch(imageUrlApiUrl);
    const imageUrlData = await imageUrlResponse.json();

    if (imageUrlData.error) {
      console.error("Error getting image info:", imageUrlData.error.info);
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

document.addEventListener("dblclick", async (event) => {
  const ctrlDoubleClick = await browser.storage.sync.get({
    ctrlDoubleClick: false,
  });

  // Check if modifier key is required and pressed
  if (ctrlDoubleClick.ctrlDoubleClick && !(event.ctrlKey || event.metaKey)) {
    return;
  }

  const selectedText = window.getSelection().toString().trim();
  if (!selectedText) return;

  // Fetch definition using API
  const definitionApiUrl = `https://en.wiktionary.org/api/rest_v1/page/definition/${selectedText}`;

  try {
    const response = await fetch(definitionApiUrl);
    const definitionData = await response.json();

    // Extract English definitions
    let englishDefinitions = [];
    if (definitionData && definitionData.en) {
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
          example = `<br><span style="font-size: small; font-style: italic;">E.g: ${stripHtml(
            defEntry.examples[0]
          )}</span>`;
        }

        definitionList.push(
          `<span style="font-size: small; font-style: italic;">${partOfSpeech}:</span> ${definition}${example}`
        );
        usedPartsOfSpeech.add(partOfSpeech);
        definitionCount++;

        if (definitionCount >= 2) {
          break;
        }
      }

      meanings = definitionList.join("<br>");
    } else {
      meanings = "No definitions found for this word.";
    }

    // Get pronunciation URL
    const pronunciationUrl = await getPronunciationUrl(selectedText);

    // Calculate max pop-up dimensions
    const maxWidth = window.innerWidth * 0.35;
    const maxHeight = window.innerHeight * 0.35;

    // Create and position the pop-up
    const popup = document.createElement("div");
    popup.id = "dictionary-popup";

    // Create content elements
    const title = document.createElement("strong");
    title.textContent = selectedText;

    // Append audio icon only if pronunciation URL is available
    if (pronunciationUrl) {
      // Create audio icon
      const audioIcon = document.createElement("img");
      audioIcon.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M3 9v6h4l5 5V4L7 9H3zm13.5 3c0 1.77-1.02 3.29-2.5 4.03v-8.07c1.48.73 2.5 2.25 2.5 4.04M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.28 7-8.77s-2.99-7.86-7-8.77z'%3E%3C/path%3E%3C/svg%3E";
      audioIcon.style.width = "20px";
      audioIcon.style.height = "20px";
      audioIcon.style.cursor = "pointer";
      audioIcon.style.marginLeft = "5px";
      audioIcon.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevent the click from closing the popup
        if (pronunciationUrl) {
          new Audio(pronunciationUrl).play();
        } else {
          alert("Pronunciation not available.");
        }
      });

      title.appendChild(audioIcon);
    }
    const lineBreak = document.createElement("br");
    const meaningsDiv = document.createElement("div");
    meaningsDiv.innerHTML = meanings;

    // Append content to the popup
    popup.appendChild(title);
    popup.appendChild(lineBreak);
    popup.appendChild(meaningsDiv);

    // popup.innerHTML = `
    //     <strong>${selectedText}</strong>
    //     <br>
    //     ${meanings}
    //   `;
    popup.style.position = "absolute";
    popup.style.top = `${event.pageY}px`;
    popup.style.left = `${event.pageX}px`;
    popup.style.backgroundColor = "rgba(144, 238, 144, 0.90)"; // Semi-transparent green
    popup.style.color = "black"; // Font color set to black
    popup.style.border = "1px solid #ccc";
    popup.style.borderRadius = "10px"; /* Add rounded edges */
    popup.style.padding = "10px";
    popup.style.zIndex = 1000;
    popup.style.maxWidth = `${maxWidth}px`;
    popup.style.maxHeight = `${maxHeight}px`;
    popup.style.overflow = "auto"; // Add scrollbars if content overflows

    document.body.appendChild(popup);

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
});
