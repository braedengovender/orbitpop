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

  let notFollowingBack = [];

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

      const followers = extractFollowers(followersData);
      const following = extractFollowing(followingData);

      calculateResults(followers, following);

      statusText.textContent = "Done.";

      results.classList.remove("hidden");
      requestAnimationFrame(function () { results.classList.add("in"); });
      results.scrollIntoView({ behavior: "smooth" });

    } catch (error) {
      console.error(error);
      statusText.textContent = "Something went wrong reading the export.";
    }
  }

  function extractFollowers(data) {
    const usernames = new Set();
    for (const person of data) {
      if (!person.string_list_data) continue;
      for (const item of person.string_list_data) {
        if (item.value) usernames.add(item.value.toLowerCase());
      }
    }
    return usernames;
  }

  function extractFollowing(data) {
    const usernames = new Set();
    const relationships = data.relationships_following || [];
    for (const person of relationships) {
      if (person.title) usernames.add(person.title.toLowerCase());
    }
    return usernames;
  }

  function calculateResults(followers, following) {
    notFollowingBack = [];
    for (const username of following) {
      if (!followers.has(username)) notFollowingBack.push(username);
    }

    const notFollowedBack = [];
    for (const username of followers) {
      if (!following.has(username)) notFollowedBack.push(username);
    }

    followersCount.textContent = followers.size;
    followingCount.textContent = following.size;
    notFollowingBackCount.textContent = notFollowingBack.length;
    notFollowedBackCount.textContent = notFollowedBack.length;

    displayUsers(notFollowingBack);
  }

  function displayUsers(users) {
    userList.innerHTML = "";

    if (users.length === 0) {
      userList.innerHTML = '<div class="row"><span>No accounts found.</span></div>';
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

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Copy";
      btn.addEventListener("click", function () { copyUsername(username); });

      row.appendChild(dot);
      row.appendChild(link);
      row.appendChild(btn);
      userList.appendChild(row);
    });
  }

  searchInput.addEventListener("input", function () {
    const term = searchInput.value.toLowerCase().trim();
    const filtered = notFollowingBack.filter(function (u) { return u.includes(term); });
    displayUsers(filtered);
  });

  function copyUsername(username) {
    navigator.clipboard.writeText("@" + username);
  }

  copyButton.addEventListener("click", function () {
    if (notFollowingBack.length === 0) return;
    const text = notFollowingBack.map(function (u) { return "@" + u; }).join("\n");
    navigator.clipboard.writeText(text);
    copyButton.textContent = "Copied!";
    setTimeout(function () { copyButton.textContent = "Copy usernames"; }, 1500);
  });
})();