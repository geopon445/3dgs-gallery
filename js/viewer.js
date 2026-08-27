(async function () {
  const root = document.getElementById("viewer-root");
  const titleEl = document.getElementById("work-title");

  function showError(msg) {
    const div = document.createElement("div");
    div.className = "viewer-error";
    div.textContent = msg;
    root.appendChild(div);
  }

  const params = new URLSearchParams(location.search);
  const workId = params.get("work");
  if (!workId) {
    showError("作品が指定されていません。");
    return;
  }

  let manifest;
  try {
    const res = await fetch("manifest.json?v=" + Date.now());
    manifest = await res.json();
  } catch (e) {
    showError("manifest.jsonの読み込みに失敗しました。");
    return;
  }

  const work = (manifest.works || []).find((w) => w.id === workId);
  if (!work) {
    showError('作品 "' + workId + '" が見つかりません。');
    return;
  }

  titleEl.textContent = work.title || work.id;

  const viewer = new window["Gaussian Splats 3D"].Viewer({
    rootElement: root,
    cameraUp: work.up || [0, -1, 0],
    initialCameraPosition: work.cameraPosition || [0, 1, 5],
    initialCameraLookAt: work.cameraLookAt || [0, 0, 0],
    sharedMemoryForWorkers: false,
  });

  try {
    await viewer.addSplatScene(work.file, {
      showLoadingUI: true,
      splatAlphaRemovalThreshold: 5,
    });
    viewer.start();
  } catch (e) {
    console.error(e);
    showError("スプラットの読み込みに失敗しました: " + e.message);
  }
})();
