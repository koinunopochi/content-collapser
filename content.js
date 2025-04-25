/**
 * DocBaseの投稿本文が含まれるメインのコンテナ要素のセレクタ
 */
const CONTENT_AREA_SELECTOR = '.js-post-to-html';

/**
 * 指定された見出し以降の兄弟要素を、次の適切な見出しが現れるまで非表示/表示を切り替える関数
 * @param {HTMLElement} heading - クリックされた見出し要素 (H2-H6)
 */
function toggleSection(heading) {
  const isExpanded = heading.getAttribute('aria-expanded') === 'true';
  const headingLevel = parseInt(heading.tagName.substring(1));

  // ★デバッグログ追加: 関数呼び出しと状態表示
  console.log(`[DEBUG] toggleSection呼び出し: ${heading.tagName} (レベル${headingLevel}), 現在の状態: ${isExpanded ? '展開中' : '折りたたみ中'}`);

  // 状態を反転させて属性を更新
  heading.setAttribute('aria-expanded', String(!isExpanded));

  let element = heading.nextElementSibling;
  let toggledElementCount = 0; // ループ回数（処理対象要素数）

  // ★デバッグログ追加: ループ開始前の要素
  console.log(`[DEBUG] ループ開始前の次の要素:`, element);

  while (element) {
    // ★デバッグログ追加: ループ中の現在要素
    console.log(`[DEBUG] ループ ${toggledElementCount + 1}: 現在チェック中の要素:`, element);

    if (element.tagName.startsWith('H')) {
      const currentLevel = parseInt(element.tagName.substring(1));
      if (!isNaN(currentLevel) && currentLevel <= headingLevel) {
        // ★デバッグログ追加: ループ停止条件合致
        console.log(`[DEBUG]   次の見出し ${element.tagName} (レベル${currentLevel}) が停止条件 (<= ${headingLevel}) に合致したためループ終了。`);
        break; // Stop condition
      } else {
        // ★デバッグログ追加: 見出しだが停止せず
         console.log(`[DEBUG]   要素は ${element.tagName} (レベル${currentLevel}) ですが、停止条件には合致せず。処理を続行。`);
      }
    }

    // ★デバッグログ追加: 表示/非表示切り替え直前
    console.log(`[DEBUG]   要素 ${element.tagName} の hidden 属性を ${isExpanded} に設定します。`);
    element.hidden = isExpanded; // Toggle visibility
    toggledElementCount++;

    element = element.nextElementSibling;
    // ★デバッグログ追加: 次の要素へ移動後
    console.log(`[DEBUG]   次の兄弟要素へ移動 → `, element);
  }

  // ★デバッグログ追加: ループ終了後
  console.log(`[DEBUG] ループ終了。合計 ${toggledElementCount} 個の要素の表示/非表示を切り替えました。`);

  // Optional: Add/remove class for styling collapsed state
  heading.classList.toggle('collapsed-content', isExpanded);
}

/**
 * メインの初期化関数：見出し要素を探してイベントリスナーを設定する
 */
function initializeCollapsibleHeadings() {
  const contentArea = document.querySelector(CONTENT_AREA_SELECTOR);
  if (!contentArea) {
    return;
  }

  const headings = contentArea.querySelectorAll('h2, h3, h4, h5, h6');
  let initializedCount = 0;

  headings.forEach(heading => {
    if (heading.dataset.collapsibleInitialized === 'true') {
      return;
    }
    heading.dataset.collapsibleInitialized = 'true';
    heading.style.cursor = 'pointer';
    heading.title = 'クリックして内容を折りたたむ/展開する';
    heading.setAttribute('role', 'button');
    if (!heading.hasAttribute('aria-expanded')) {
      heading.setAttribute('aria-expanded', 'true');
    }
    heading.classList.toggle('collapsed-content', heading.getAttribute('aria-expanded') === 'false');

    heading.addEventListener('click', (event) => {
       // ★もしイベント競合が疑われるなら、次の行のコメントを解除して試す
       // event.stopPropagation();

       // ★デバッグログ追加: クリックイベント発生
       console.log(`[DEBUG] クリックイベント発生: ${heading.tagName} 「${heading.textContent.trim().substring(0,20)}...」`);
       toggleSection(heading);
    });
    initializedCount++;
  });

  if (initializedCount > 0) {
    console.log(`見出し折りたたみ: 新たに ${initializedCount} 個の H2-H6 見出しを初期化しました。`);
  }
}

// --- MutationObserver で動的読み込みに対応 ---
console.log("見出し折りたたみ: 初期化処理とDOM監視を開始します。");
const observer = new MutationObserver((mutationsList) => {
  let needsReInit = false;
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches(CONTENT_AREA_SELECTOR) || node.querySelector(CONTENT_AREA_SELECTOR) ||
              (node.matches('h2, h3, h4, h5, h6') && node.closest(CONTENT_AREA_SELECTOR))) {
            needsReInit = true;
            break;
          }
        }
      }
    }
    if (needsReInit) break;
  }
  if (needsReInit) {
    setTimeout(initializeCollapsibleHeadings, 100);
  }
});
function startObserver() {
    const targetNode = document.body;
    if (!targetNode) {
        setTimeout(startObserver, 100);
        return;
    }
    const config = { childList: true, subtree: true };
    observer.observe(targetNode, config);
    console.log("見出し折りたたみ: DOM監視を開始しました。");
}
setTimeout(() => {
    console.log("見出し折りたたみ: 初回初期化を試みます...");
    initializeCollapsibleHeadings();
    startObserver();
}, 500);
