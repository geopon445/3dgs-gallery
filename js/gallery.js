(async function () {
  const grid = document.getElementById("grid");

  let manifest;
  try {
    const res = await fetch("manifest.json?v=" + Date.now());
    manifest = await res.json();
  } catch (e) {
    grid.innerHTML = '<p class="empty">manifest.jsonの読み込みに失敗しました。</p>';
    return;
  }

  const works = manifest.works || [];
  if (works.length === 0) {
    grid.innerHTML = '<p class="empty">まだ作品がありません。</p>';
    return;
  }

  grid.innerHTML = "";
  for (const w of works) {
    const a = document.createElement("a");
    a.className = "card";
    a.href = "viewer.html?work=" + encodeURIComponent(w.id);

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (w.thumbnail) {
      const img = document.createElement("img");
      img.src = w.thumbnail;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      thumb.appendChild(img);
    } else {
      thumb.textContent = "◆";
    }

    const info = document.createElement("div");
    info.className = "info";
    const h2 = document.createElement("h2");
    h2.textContent = w.title || w.id;
    const p = document.createElement("p");
    p.textContent = w.description || "";
    info.appendChild(h2);
    info.appendChild(p);

    a.appendChild(thumb);
    a.appendChild(info);
    grid.appendChild(a);
  }
})();
