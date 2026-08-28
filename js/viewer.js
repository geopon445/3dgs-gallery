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

  // WASD(+QE上下)でのFPS風移動。OrbitControls標準のキー操作は視点固定のまま画面内を
  // スライドする「パン」であり、前進/後退ができないため、カメラそのものを動かす仕組みを
  // 別途追加する。ライブラリ自身のレンダーループ(selfDrivenMode)はviewer.cameraを毎フレーム
  // 描画するだけなので、外部から独立したrequestAnimationFrameループでcamera.positionを
  // 直接動かしても競合しない。
  (function setupFlyControls() {
    const KEY_MAP = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d", KeyQ: "q", KeyE: "e" };
    const state = { w: false, a: false, s: false, d: false, q: false, e: false };
    window.addEventListener("keydown", (ev) => {
      const k = KEY_MAP[ev.code];
      if (k) state[k] = true;
    });
    window.addEventListener("keyup", (ev) => {
      const k = KEY_MAP[ev.code];
      if (k) state[k] = false;
    });
    const SPEED = work.flySpeed || 3; // units/sec
    let lastT = performance.now();
    function tick() {
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.1);
      lastT = now;
      const dir = new window.THREE.Vector3(
        (state.d ? 1 : 0) - (state.a ? 1 : 0),
        (state.e ? 1 : 0) - (state.q ? 1 : 0),
        (state.s ? 1 : 0) - (state.w ? 1 : 0)
      );
      if (dir.lengthSq() > 0 && viewer.camera && viewer.controls) {
        dir.normalize().multiplyScalar(SPEED * dt);
        dir.applyQuaternion(viewer.camera.quaternion);
        viewer.camera.position.add(dir);
        viewer.controls.target.add(dir);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  const FORMAT_MAP = {
    ply: window["Gaussian Splats 3D"].SceneFormat.Ply,
    spz: window["Gaussian Splats 3D"].SceneFormat.Spz,
    splat: window["Gaussian Splats 3D"].SceneFormat.Splat,
    ksplat: window["Gaussian Splats 3D"].SceneFormat.KSplat,
  };

  // 25MB超のファイルはGitHubのUpload files画面(Web UI)で直接扱えないため、
  // 8MB程度の断片(part-001.bin, part-002.bin, ...)に分割してリポジトリに置く運用を
  // manifest.jsonの"chunked":trueで表現する。
  async function loadChunked(work) {
    const baseUrl = work.file;
    let buffers;
    if (work.chunkCount) {
      // manifest側にチャンク数が記録されていれば、逐次404判定を待たず全断片を並列取得できる
      // (順番に1つずつawaitしていると、断片数が多いファイルで通信時間が積み重なり非常に遅くなる)。
      const urls = [];
      for (let i = 1; i <= work.chunkCount; i++) {
        urls.push(baseUrl + String(i).padStart(3, "0") + ".bin");
      }
      buffers = await Promise.all(urls.map((u) => fetch(u).then((r) => r.arrayBuffer())));
    } else {
      // 後方互換: chunkCount未記録の古いmanifestエントリ向けに、404が出るまで順番に取得する旧方式
      buffers = [];
      for (let n = 1; ; n++) {
        const url = baseUrl + String(n).padStart(3, "0") + ".bin";
        const res = await fetch(url);
        if (!res.ok) break;
        buffers.push(await res.arrayBuffer());
      }
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
      sourceUrl = await loadChunked(work);
      addOptions.format = format;
    }
    await viewer.addSplatScene(sourceUrl, addOptions);
    viewer.start();
  } catch (e) {
    console.error(e);
    showError("スプラットの読み込みに失敗しました: " + e.message);
  }
})();
