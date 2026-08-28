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

  const FORMAT_MAP = {
    ply: window["Gaussian Splats 3D"].SceneFormat.Ply,
    spz: window["Gaussian Splats 3D"].SceneFormat.Spz,
    splat: window["Gaussian Splats 3D"].SceneFormat.Splat,
    ksplat: window["Gaussian Splats 3D"].SceneFormat.KSplat,
  };

  // 25MB超のファイルはGitHubのUpload files画面(Web UI)で直接扱えないため、
  // 20MB程度の断片(part-001.bin, part-002.bin, ...)に分割してリポジトリに置く運用を
  // manifest.jsonの"chunked":trueで表現する。断片が何個あるかはmanifest側に持たせず、
  // 存在しなくなる(fetchが失敗する)まで連番を取得し続けて自動判定する。
  async function loadChunked(baseUrl) {
    const buffers = [];
    for (let n = 1; ; n++) {
      const url = baseUrl + String(n).padStart(3, "0") + ".bin";
      const res = await fetch(url);
      if (!res.ok) break;
      buffers.push(await res.arrayBuffer());
    }
    if (buffers.length === 0) {
      throw new Error("チャンクファイルが見つかりません: " + baseUrl + "001.bin");
    }
    return URL.createObjectURL(new Blob(buffers));
  }

  try {
    let sourceUrl = work.file;
    const addOptions = {
      showLoadingUI: true,
      splatAlphaRemovalThreshold: 5,
    };
    if (work.chunked) {
      const format = FORMAT_MAP[work.format];
      if (format === undefined) {
        throw new Error('chunked:trueの場合は"format"(ply/spz/splat/ksplat)の指定が必要です');
      }
      sourceUrl = await loadChunked(work.file);
      addOptions.format = format;
    }
    await viewer.addSplatScene(sourceUrl, addOptions);
    viewer.start();
  } catch (e) {
    console.error(e);
    showError("スプラットの読み込みに失敗しました: " + e.message);
  }
})();
