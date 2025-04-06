function saveOptions() {
    const ctrlDoubleClick = document.getElementById('ctrlDoubleClick').checked;
    browser.storage.sync.set({
      ctrlDoubleClick: ctrlDoubleClick
    }).then(() => {
      console.log('Options saved');
    });
  }
  
  function restoreOptions() {
    browser.storage.sync.get({
      ctrlDoubleClick: false
    }).then((result) => {
      document.getElementById('ctrlDoubleClick').checked = result.ctrlDoubleClick;
    });
  }
  
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('ctrlDoubleClick').addEventListener('change', saveOptions);
  