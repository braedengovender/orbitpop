(function () {
  const fileInput = document.getElementById("fileInput");
  const uploadBox = document.getElementById("uploadBox");
  const statusText = document.getElementById("status");

  const results = document.getElementById("results");

  const followersCount = document.getElementById("followersCount");
  const followingCount = document.getElementById("followingCount");
  const notFollowingBackCount = document.getElementById("notFollowingBackCount");
  const notFollowedBackCount = document.getElementById("notFollowedBackCount");

  const userList = document.getElementById("userList");
  const searchInput = document.getElementById("searchInput");
  const copyButton = document.getElementById("copyButton");
  const sortSelect = document.getElementById("sortSelect");
  const filterSelect = document.getElementById("filterSelect");
  const excludedNote = document.getElementById("excludedNote");

  const ledgerTitle = document.getElementById("ledgerTitle");
  const ledgerDesc = document.getElementById("ledgerDesc");
  const tabButtons = {
    notFollowingBack: document.getElementById("tab-notFollowingBack"),
    mutual: document.getElementById("tab-mutual"),
    notFollowedBack: document.getElementById("tab-notFollowedBack")
  };

  const followbackRateEl = document.getElementById("followbackRate");
  const followbackRatioEl = document.getElementById("followbackRatio");

  const compareSection = document.getElementById("compareSection");
  const compareToggle = document.getElementById("compareToggle");
  const comparePanel = document.getElementById("comparePanel");
  const compareFileInput = document.getElementById("compareFileInput");
  const compareStatus = document.getElementById("compareStatus");
  const compareResults = document.getElementById("compareResults");
  const leftOrbitCount = document.getElementById("leftOrbitCount");
  const newOrbitersCount = document.getElementById("newOrbitersCount");
  const leftOrbitList = document.getElementById("leftOrbitList");
  const newOrbitersList = document.getElementById("newOrbitersList");

  const installButton = document.getElementById("installButton");

  const NEVER_FLAG_KEY = "orbit_never_flag";

  let followersMap = new Map();
  let followingMap = new Map();

  let notFollowingBack = [];
  let mutual = [];
  let notFollowedBack = [];

  let activeTab = "notFollowingBack";
  let showFlagged = false;
  let currentVisible = [];

  let neverFlagged = loadNeverFlag();

  const TAB_INFO = {
    notFollowingBack: {
      title: "drifting out of orbit",
      desc: "accounts you follow that don't follow you back - pop them from your orbit!",
      data: function () { return notFollowingBack; },
      whenPrefix: "followed "
    },
    mutual: {
      title: "mutually orbiting",
      desc: "accounts that follow you and you follow back.",
      data: function () { return mutual; },
      whenPrefix: "followed "
    },
    notFollowedBack: {
      title: "orbiting you",
      desc: "accounts that follow you, but you don't follow back - add them to your orbit before they pop you!",
      data: function () { return notFollowedBack; },
      whenPrefix: "followed you "
    }
  };

  function loadNeverFlag() {
    try {
      const raw = localStorage.getItem(NEVER_FLAG_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveNeverFlag() {
    try {
      localStorage.setItem(NEVER_FLAG_KEY, JSON.stringify(Array.from(neverFlagged)));
    } catch (e) {
      /* storage unavailable, flags just won't persist */
    }
  }

  fileInput.addEventListener("change", function () {
    if (fileInput.files.length === 0) return;
    processInstagramZip(fileInput.files[0]);
  });

  uploadBox.addEventListener("dragover", function (event) {
    event.preventDefault();
    uploadBox.classList.add("dragover");
  });

  uploadBox.addEventListener("dragleave", function () {
    uploadBox.classList.remove("dragover");
  });

  uploadBox.addEventListener("drop", function (event) {
    event.preventDefault();
    uploadBox.classList.remove("dragover");
    const files = event.dataTransfer.files;
    if (files.length === 0) return;
    processInstagramZip(files[0]);
  });

  async function processInstagramZip(file) {
    statusText.textContent = "Reading your export...";

    try {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        statusText.textContent = "Please upload the Instagram ZIP file.";
        return;
      }

      const zip = await JSZip.loadAsync(file);

      let followersFile = null;
      let followingFile = null;

      for (const filename of Object.keys(zip.files)) {
        const lowerName = filename.toLowerCase();
        if (lowerName.includes("followers_1.json")) followersFile = zip.files[filename];
        if (lowerName.endsWith("following.json")) followingFile = zip.files[filename];
      }

      if (!followersFile) {
        statusText.textContent = "Could not find followers_1.json in the ZIP.";
        return;
      }
      if (!followingFile) {
        statusText.textContent = "Could not find following.json in the ZIP.";
        return;
      }

      statusText.textContent = "Comparing followers and following...";

      const followersText = await followersFile.async("text");
      const followingText = await followingFile.async("text");

      const followersData = JSON.parse(followersText);
      const followingData = JSON.parse(followingText);

      followersMap = extractFollowers(followersData);
      followingMap = extractFollowing(followingData);

      calculateResults();

      statusText.textContent = "Done.";

      results.classList.remove("hidden");
      compareSection.classList.remove("hidden");
      requestAnimationFrame(function () { results.classList.add("in"); });
      results.scrollIntoView({ behavior: "smooth" });

    } catch (error) {
      console.error(error);
      statusText.textContent = "Something went wrong reading the export.";
    }
  }

  function extractFollowers(data) {
    const map = new Map();
    for (const person of data) {
      if (!person.string_list_data) continue;
      for (const item of person.string_list_data) {
        if (item.value) map.set(item.value.toLowerCase(), item.timestamp || 0);
      }
    }
    return map;
  }

  function extractFollowing(data) {
    const map = new Map();
    const relationships = data.relationships_following || [];
    for (const person of relationships) {
      const entry = person.string_list_data && person.string_list_data[0];
      const username = person.title || (entry && entry.value);
      if (username) map.set(username.toLowerCase(), (entry && entry.timestamp) || 0);
    }
    return map;
  }

  function calculateResults() {
    const followersSet = new Set(followersMap.keys());
    const followingSet = new Set(followingMap.keys());

    notFollowingBack = [];
    mutual = [];
    followingSet.forEach(function (username) {
      const entry = { username: username, timestamp: followingMap.get(username) || 0 };
      if (followersSet.has(username)) mutual.push(entry);
      else notFollowingBack.push(entry);
    });

    notFollowedBack = [];
    followersSet.forEach(function (username) {
      if (!followingSet.has(username)) {
        notFollowedBack.push({ username: username, timestamp: followersMap.get(username) || 0 });
      }
    });

    followersCount.textContent = followersSet.size;
    followingCount.textContent = followingSet.size;
    notFollowingBackCount.textContent = notFollowingBack.length;
    notFollowedBackCount.textContent = notFollowedBack.length;

    const rate = followingSet.size === 0 ? 0 : Math.round((mutual.length / followingSet.size) * 100);
    followbackRateEl.textContent = rate + "%";

    const ratio = followingSet.size === 0 ? "—" : (followersSet.size / followingSet.size).toFixed(2);
    followbackRatioEl.textContent = ratio;

    updateTabLabels();
    renderList();
  }

  function updateTabLabels() {
    tabButtons.notFollowingBack.textContent = "don't follow back (" + notFollowingBack.length + ")";
    tabButtons.mutual.textContent = "mutual (" + mutual.length + ")";
    tabButtons.notFollowedBack.textContent = "don't follow you (" + notFollowedBack.length + ")";
  }

  Object.keys(tabButtons).forEach(function (key) {
    tabButtons[key].addEventListener("click", function () {
      activeTab = key;
      Object.keys(tabButtons).forEach(function (k) { tabButtons[k].classList.remove("active"); });
      tabButtons[key].classList.add("active");
      ledgerTitle.textContent = TAB_INFO[key].title;
      ledgerDesc.textContent = TAB_INFO[key].desc;
      renderList();
    });
  });

  function formatWhen(timestamp) {
    if (!timestamp) return "";
    return new Date(timestamp * 1000).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }

  function applySort(list) {
    const sorted = list.slice();
    switch (sortSelect.value) {
      case "az":
        sorted.sort(function (a, b) { return a.username.localeCompare(b.username); });
        break;
      case "za":
        sorted.sort(function (a, b) { return b.username.localeCompare(a.username); });
        break;
      case "oldest":
        sorted.sort(function (a, b) { return a.timestamp - b.timestamp; });
        break;
      default:
        sorted.sort(function (a, b) { return b.timestamp - a.timestamp; });
    }
    return sorted;
  }

  function applyDateFilter(list) {
    const days = filterSelect.value;
    if (days === "all") return list;
    const cutoff = Date.now() / 1000 - parseInt(days, 10) * 86400;
    return list.filter(function (e) { return e.timestamp >= cutoff; });
  }

  function renderList() {
    const term = searchInput.value.toLowerCase().trim();
    const fullList = TAB_INFO[activeTab].data();
    const flaggedCount = fullList.filter(function (e) { return neverFlagged.has(e.username); }).length;

    let list = showFlagged
      ? fullList
      : fullList.filter(function (e) { return !neverFlagged.has(e.username); });

    list = applyDateFilter(list);
    list = applySort(list);

    if (term) list = list.filter(function (e) { return e.username.includes(term); });

    currentVisible = list;
    displayUsers(list);
    renderExcludedNote(flaggedCount);
  }

  function renderExcludedNote(flaggedCount) {
    excludedNote.innerHTML = "";

    if (flaggedCount === 0 && !showFlagged) return;

    const text = document.createElement("span");
    text.textContent = showFlagged
      ? "showing never-flagged accounts. "
      : flaggedCount + (flaggedCount === 1 ? " account never flagged. " : " accounts never flagged. ");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = showFlagged ? "hide them again" : "show them";
    toggle.addEventListener("click", function () {
      showFlagged = !showFlagged;
      renderList();
    });

    excludedNote.appendChild(text);
    excludedNote.appendChild(toggle);
  }

  function displayUsers(list) {
    userList.innerHTML = "";

    if (list.length === 0) {
      userList.innerHTML = '<div class="row"><span>No accounts found.</span></div>';
      return;
    }

    const whenPrefix = TAB_INFO[activeTab].whenPrefix;

    list.forEach(function (entry) {
      const username = entry.username;

      const row = document.createElement("div");
      row.className = "row";
      if (neverFlagged.has(username)) row.classList.add("is-flagged");

      const dot = document.createElement("span");
      dot.className = "dot";

      const main = document.createElement("div");
      main.className = "row-main";

      const link = document.createElement("a");
      link.className = "uname";
      link.href = "https://www.instagram.com/" + encodeURIComponent(username) + "/";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "@" + username;
      main.appendChild(link);

      const when = formatWhen(entry.timestamp);
      if (when) {
        const whenEl = document.createElement("span");
        whenEl.className = "when";
        whenEl.textContent = whenPrefix + when;
        main.appendChild(whenEl);
      }

      const actions = document.createElement("div");
      actions.className = "row-actions";

      const flagBtn = document.createElement("button");
      flagBtn.type = "button";
      flagBtn.textContent = neverFlagged.has(username) ? "un-flag" : "never flag";
      flagBtn.title = "Never show this account in this list again";
      flagBtn.addEventListener("click", function () {
        if (neverFlagged.has(username)) neverFlagged.delete(username);
        else neverFlagged.add(username);
        saveNeverFlag();
        renderList();
      });

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.textContent = "copy";
      copyBtn.addEventListener("click", function () { copyUsername(username); });

      actions.appendChild(flagBtn);
      actions.appendChild(copyBtn);

      row.appendChild(dot);
      row.appendChild(main);
      row.appendChild(actions);
      userList.appendChild(row);
    });
  }

  searchInput.addEventListener("input", renderList);
  sortSelect.addEventListener("change", renderList);
  filterSelect.addEventListener("change", renderList);

  function copyUsername(username) {
    navigator.clipboard.writeText("@" + username);
  }

  copyButton.addEventListener("click", function () {
    if (currentVisible.length === 0) return;
    const text = currentVisible.map(function (e) { return "@" + e.username; }).join("\n");
    navigator.clipboard.writeText(text);
    copyButton.textContent = "copied!";
    setTimeout(function () { copyButton.textContent = "copy usernames"; }, 1500);
  });

  // ---------- COMPARE WITH AN OLDER EXPORT ----------

  compareToggle.addEventListener("click", function () {
    comparePanel.classList.toggle("hidden");
  });

  compareFileInput.addEventListener("change", function () {
    if (compareFileInput.files.length === 0) return;
    compareInstagramZip(compareFileInput.files[0]);
  });

  async function compareInstagramZip(file) {
    compareStatus.textContent = "Reading previous export...";

    try {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        compareStatus.textContent = "Please upload a ZIP file.";
        return;
      }

      const zip = await JSZip.loadAsync(file);

      let followersFile = null;
      for (const filename of Object.keys(zip.files)) {
        if (filename.toLowerCase().includes("followers_1.json")) followersFile = zip.files[filename];
      }

      if (!followersFile) {
        compareStatus.textContent = "Could not find followers_1.json in that ZIP.";
        return;
      }

      const text = await followersFile.async("text");
      const previousMap = extractFollowers(JSON.parse(text));

      renderCompare(previousMap);
      compareStatus.textContent = "Compared with your current export.";

    } catch (error) {
      console.error(error);
      compareStatus.textContent = "Something went wrong reading that export.";
    }
  }

  function renderCompare(previousMap) {
    const currentSet = new Set(followersMap.keys());
    const previousSet = new Set(previousMap.keys());

    const left = Array.from(previousSet).filter(function (u) { return !currentSet.has(u); }).sort();
    const joined = Array.from(currentSet).filter(function (u) { return !previousSet.has(u); }).sort();

    leftOrbitCount.textContent = left.length;
    newOrbitersCount.textContent = joined.length;

    renderSimpleList(leftOrbitList, left);
    renderSimpleList(newOrbitersList, joined);

    compareResults.classList.remove("hidden");
  }

  function renderSimpleList(container, users) {
    container.innerHTML = "";

    if (users.length === 0) {
      container.innerHTML = '<div class="row"><span>none.</span></div>';
      return;
    }

    users.forEach(function (username) {
      const row = document.createElement("div");
      row.className = "row";

      const dot = document.createElement("span");
      dot.className = "dot";

      const link = document.createElement("a");
      link.className = "uname";
      link.href = "https://www.instagram.com/" + encodeURIComponent(username) + "/";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "@" + username;

      row.appendChild(dot);
      row.appendChild(link);
      container.appendChild(row);
    });
  }

  // ---------- INSTALL AS APP ----------

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  let deferredInstallPrompt = null;

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.classList.remove("hidden");
  });

  installButton.addEventListener("click", async function () {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.classList.add("hidden");
  });

  window.addEventListener("appinstalled", function () {
    installButton.classList.add("hidden");
  });
})();