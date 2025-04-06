const faScript = document.createElement('script');
faScript.src = 'https://kit.fontawesome.com/your-font-awesome-kit-id.js';
document.head.appendChild(faScript);

document.addEventListener("dblclick", async (event) => {
    const selectedText = window.getSelection().toString().trim();
    if (!selectedText) return;
  
    // Fetch definition and pronunciation
    const apiUrl = `https://en.wiktionary.org/api/rest_v1/page/definition/${selectedText}`;
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
  
      // Extract first two definitions
      const meanings = data.en[0].definitions.slice(0, 2).map((def, index) => {
        let definition = def.definition;
        if (index === 0 && def.examples) {
          definition += `<br>Example: ${def.examples[0]}`;
        }
        return definition;
      }).join("<br>");
  
      const audioUrl = data.en[0].pronunciations ? data.en[0].pronunciations[0].audio.url : null;
  
      // Create and position the pop-up
      const popup = document.createElement("div");
      popup.id = "dictionary-popup";
      popup.innerHTML = `
        <strong>${selectedText}</strong> 
        ${audioUrl ? `<audio controls src="${audioUrl}"></audio>` : ""}
        <br>
        ${meanings}
      `;
      popup.style.position = "absolute";
      popup.style.top = `${event.pageY}px`;
      popup.style.left = `${event.pageX}px`;
      popup.style.backgroundColor = "#fff";
      popup.style.border = "1px solid #ccc";
      popup.style.padding = "10px";
      popup.style.zIndex = 1000;
  
      document.body.appendChild(popup);
  
      // Remove pop-up on click outside
      document.addEventListener("click", () => {
        if (popup) popup.remove();
      }, { once: true });
    } catch (error) {
      console.error("Error fetching data from Wiktionary:", error);
    }
  });
  