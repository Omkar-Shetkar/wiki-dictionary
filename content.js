function stripHtml(html) {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }
  
  document.addEventListener("dblclick", async (event) => {
    const ctrlDoubleClick = await browser.storage.sync.get({ ctrlDoubleClick: false });

    if (ctrlDoubleClick.ctrlDoubleClick && !event.ctrlKey) {
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
          let definition = stripHtml(entry.definitions[0].definition);
          let example = '';
  
          if (entry.definitions[0].examples && entry.definitions[0].examples.length > 0) {
            example = `<br><span style="font-size: small; font-style: italic;">E.g: ${stripHtml(entry.definitions[0].examples[0])}</span>`;
          }
  
          definitionList.push(`<span style="font-size: small; font-style: italic;">${partOfSpeech}:</span> ${definition}${example}`);
          usedPartsOfSpeech.add(partOfSpeech);
          definitionCount++;
  
          if (definitionCount >= 2) {
            break;
          }
        }
  
        meanings = definitionList.join("<br>");
      }
  
      // Calculate max pop-up dimensions
      const maxWidth = window.innerWidth * 0.35;
      const maxHeight = window.innerHeight * 0.35;
  
      // Create and position the pop-up
      const popup = document.createElement("div");
      popup.id = "dictionary-popup";
      popup.innerHTML = `
        <strong>${selectedText}</strong>
        <br>
        ${meanings}
      `;
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
      popup.style.overflow = 'auto'; // Add scrollbars if content overflows
  
      document.body.appendChild(popup);
  
      // Remove pop-up on click outside
      document.addEventListener("click", () => {
        if (popup) popup.remove();
      }, { once: true });
  
    } catch (error) {
      console.error("Error fetching data from Wiktionary:", error);
    }
  });
  