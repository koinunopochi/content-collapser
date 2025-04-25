/**
 * DocBaseの投稿本文が含まれるメインのコンテナ要素のセレクタ
 */
const CONTENT_AREA_SELECTOR = '.js-post-to-html';
/**
 * localStorage に状態を保存する際のキーの接頭辞
 */
const STORAGE_KEY_PREFIX = 'docbase-collapse-state:';

/**
 * 現在のページに対応する localStorage のキーを取得する関数
 * @returns {string} localStorage用のキー
 */
function getStorageKey() {
  // ページのパス名をキーの一部として使用し、ページごとに状態を管理
  // より堅牢にするには、DocBaseの固有IDなどがあればそれを使うのが望ましい
  const path = window.location.pathname;
  return `${STORAGE_KEY_PREFIX}${path}`;
}

/**
 * localStorage から指定されたキーの状態を読み込む関数
 * @returns {object} 保存されている状態オブジェクト (例: {"h2-0": false, "h3-1": true})。なければ空オブジェクト。
 */
function loadState() {
  const stateJson = localStorage.getItem(getStorageKey());
  try {
    // JSONとしてパースし、失敗したら空オブジェクトを返す
    return stateJson ? JSON.parse(stateJson) : {};
  } catch (e) {
    console.error('見出し折りたたみ状態の読み込みに失敗:', e);
    // エラー時も空オブジェクトを返し、処理を継続させる
    return {};
  }
}

/**
 * localStorage に指定されたキーで状態を保存する関数
 * @param {object} state - 保存する状態オブジェクト
 */
function saveState(state) {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(state));
  } catch (e) {
    console.error('見出し折りたたみ状態の保存に失敗:', e);
    // 保存失敗は致命的ではない場合が多いので、エラーログのみ出力
  }
}

/**
 * 見出し要素に一意な識別子を付与または取得する関数
 * @param {HTMLElement} heading - 対象の見出し要素
 * @param {Map<string, number>} headingCounters - 各見出しレベルのカウンター (例: {'H2': 0, 'H3': 1})
 * @returns {string} 生成された識別子 (例: 'h2-0', 'h3-1')
 */
function getHeadingIdentifier(heading, headingCounters) {
    const level = heading.tagName; // "H2", "H3" など
    const index = headingCounters.get(level) || 0; // 現在のカウンター値を取得、なければ0
    const identifier = `${level.toLowerCase()}-${index}`; // "h2-0" のような形式
    headingCounters.set(level, index + 1); // カウンターをインクリメント
    // データ属性に識別子を保存しておくと、後で参照しやすい
    heading.dataset.headingId = identifier;
    return identifier;
}


/**
 * 指定された見出し以降の兄弟要素を、次の適切な見出しが現れるまで非表示/表示を切り替える関数
 * @param {HTMLElement} heading - クリックされた見出し要素 (H2-H6)
 */
function toggleSection(heading) {
  const identifier = heading.dataset.headingId;
  if (!identifier) {
      console.warn('[DEBUG] 見出し識別子が見つからないため、状態の保存/復元はスキップされます:', heading);
      // 識別子がない場合でもトグル自体は試みる（保存はできない）
  }

  const isExpanded = heading.getAttribute('aria-expanded') === 'true';
  const newExpandedState = !isExpanded; // これから設定する新しい状態
  const headingLevel = parseInt(heading.tagName.substring(1));

  console.log(`[DEBUG] toggleSection呼び出し: ${heading.tagName} (ID: ${identifier || 'N/A'}), 現在の状態: ${isExpanded ? '展開中' : '折りたたみ中'} -> 新しい状態: ${newExpandedState ? '展開' : '折りたたみ'}`);

  heading.setAttribute('aria-expanded', String(newExpandedState));

  let element = heading.nextElementSibling;
  let toggledElementCount = 0;
  console.log(`[DEBUG] ループ開始前の次の要素:`, element);

  while (element) {
    console.log(`[DEBUG] ループ ${toggledElementCount + 1}: 現在チェック中の要素:`, element);

    if (element.tagName.startsWith('H')) {
      const currentLevel = parseInt(element.tagName.substring(1));
      if (!isNaN(currentLevel) && currentLevel <= headingLevel) {
        console.log(`[DEBUG]   次の見出し ${element.tagName} (レベル${currentLevel}) が停止条件 (<= ${headingLevel}) に合致したためループ終了。`);
        break; // Stop condition
      } else {
         console.log(`[DEBUG]   要素は ${element.tagName} (レベル${currentLevel}) ですが、停止条件には合致せず。処理を続行。`);
      }
    }

    // 新しい状態に基づいて表示/非表示を切り替える
    console.log(`[DEBUG]   要素 ${element.tagName} の hidden 属性を ${!newExpandedState} に設定します。`);
    element.hidden = !newExpandedState; // newExpandedStateがtrueならhidden=false(表示), falseならhidden=true(非表示)
    toggledElementCount++;

    element = element.nextElementSibling;
    console.log(`[DEBUG]   次の兄弟要素へ移動 → `, element);
  }

  console.log(`[DEBUG] ループ終了。合計 ${toggledElementCount} 個の要素の表示/非表示を切り替えました。`);
  heading.classList.toggle('collapsed-content', !newExpandedState); // 新しい状態に合わせてクラスを切り替え

  // --- 状態を localStorage に保存 ---
  if (identifier) {
      const currentState = loadState(); // 現在保存されている全状態を読み込む
      currentState[identifier] = newExpandedState; // この見出しの状態を更新
      saveState(currentState); // 更新した全状態を保存
      console.log(`[DEBUG] 状態保存: キー '${getStorageKey()}' に ${identifier}=${newExpandedState} を保存しました。`);
  }
}

/**
 * メインの初期化関数：見出し要素を探してイベントリスナーと保存された状態を設定する
 */
function initializeCollapsibleHeadings() {
  const contentArea = document.querySelector(CONTENT_AREA_SELECTOR);
  if (!contentArea) {
    console.log("見出し折りたたみ: コンテンツエリアが見つかりません。");
    return;
  }

  const headings = contentArea.querySelectorAll('h2, h3, h4, h5, h6');
  let initializedCount = 0;
  const savedState = loadState(); // ページ読み込み時に保存された状態を一括で読み込む
  console.log('[DEBUG] 初期化時に読み込んだ保存状態:', savedState);
  const headingCounters = new Map(); // 各レベルの見出しカウンターを初期化

  headings.forEach(heading => {
    // 既に初期化済みの場合はスキップ
    if (heading.dataset.collapsibleInitialized === 'true') {
      return;
    }

    // --- 識別子を生成・取得 ---
    const identifier = getHeadingIdentifier(heading, headingCounters);
    console.log(`[DEBUG] 見出し初期化中: ${identifier} (${heading.textContent.trim().substring(0,20)}...)`);

    heading.dataset.collapsibleInitialized = 'true'; // 初期化済みフラグ
    heading.style.cursor = 'pointer';
    heading.title = 'クリックして内容を折りたたむ/展開する';
    heading.setAttribute('role', 'button');

    // --- 保存された状態を適用 ---
    // savedStateに識別子のキーが存在すればその値を、なければデフォルトで true (展開) を初期状態とする
    const initialState = savedState.hasOwnProperty(identifier) ? savedState[identifier] : true;
    heading.setAttribute('aria-expanded', String(initialState));
    console.log(`[DEBUG]   初期状態設定: ${identifier} -> ${initialState ? '展開' : '折りたたみ'}`);

    // --- 初期状態に基づいて要素の表示/非表示とクラスを設定 ---
    heading.classList.toggle('collapsed-content', !initialState); // 折りたたみ状態ならクラスを追加
    let element = heading.nextElementSibling;
    let initialHideCount = 0;
    while (element) {
        if (element.tagName.startsWith('H')) {
            const currentLevel = parseInt(element.tagName.substring(1));
            const headingLevel = parseInt(heading.tagName.substring(1));
            if (!isNaN(currentLevel) && currentLevel <= headingLevel) {
                break; // 次の同レベル以上の見出しで終了
            }
        }
        // 初期状態が折りたたみの場合、後続要素を非表示にする
        element.hidden = !initialState;
        if (!initialState) initialHideCount++;
        element = element.nextElementSibling;
    }
     if (!initialState) console.log(`[DEBUG]   初期状態で ${initialHideCount} 個の要素を非表示にしました。`);


    // --- クリックイベントリスナーを設定 ---
    heading.addEventListener('click', (event) => {
       // ★もしイベント競合が疑われるなら、次の行のコメントを解除して試す
       // event.stopPropagation();

       console.log(`[DEBUG] クリックイベント発生: ${heading.tagName} (ID: ${identifier}) 「${heading.textContent.trim().substring(0,20)}...」`);
       toggleSection(heading);
    });
    initializedCount++;
  });

  if (initializedCount > 0) {
    console.log(`見出し折りたたみ: 新たに ${initializedCount} 個の H2-H6 見出しを初期化し、保存された状態を適用しました。`);
  } else {
    // console.log("見出し折りたたみ: 新たに初期化する見出しはありませんでした。");
  }
}

// --- MutationObserver で動的読み込みに対応 ---
console.log("見出し折りたたみ: 初期化処理とDOM監視を開始します。");
const observer = new MutationObserver((mutationsList) => {
  let needsReInit = false;
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        // Elementノードのみをチェック
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 追加されたノード自体がコンテンツエリアか、内部にコンテンツエリアを含むか、
          // または追加されたノードが見出しで、かつコンテンツエリア内に含まれるか
          if (node.matches(CONTENT_AREA_SELECTOR) ||
              node.querySelector(CONTENT_AREA_SELECTOR) ||
              (node.matches('h2, h3, h4, h5, h6') && node.closest(CONTENT_AREA_SELECTOR)))
          {
            // console.log("[DEBUG] 関係のあるノードが追加されたため再初期化をスケジュール:", node);
            needsReInit = true;
            break; // このmutationでのチェックは終了
          }
        }
      }
    }
    if (needsReInit) break; // 再初期化が必要なら他のmutationを見る必要はない
  }

  // 変更が検出され、再初期化が必要な場合
  if (needsReInit) {
    console.log("見出し折りたたみ: DOMの変更を検出したため、見出しの再初期化を実行します。");
    // 少し遅延させて実行することで、DOM構築が完了するのを待つ
    setTimeout(initializeCollapsibleHeadings, 100);
  }
});

function startObserver() {
    // 監視対象を body にすることで、ページ全体の変更を捉える
    const targetNode = document.body;
    if (!targetNode) {
        // body がまだ存在しない場合は少し待って再試行
        console.log("見出し折りたたみ: body 要素が見つからないため、監視開始を遅延します。");
        setTimeout(startObserver, 100);
        return;
    }
    // 監視設定: 子要素の追加/削除と、サブツリー全体の変更を監視
    const config = { childList: true, subtree: true };
    observer.observe(targetNode, config);
    console.log("見出し折りたたみ: DOM監視を開始しました (対象: body)。");
}

// --- 初期化実行 ---
// DOMContentLoadedよりも少し遅らせて、DocBaseのコンテンツ描画を待つ可能性があるためsetTimeoutを使用
setTimeout(() => {
    console.log("見出し折りたたみ: 初回初期化を試みます...");
    initializeCollapsibleHeadings();
    // 初回初期化後に監視を開始
    startObserver();
}, 500); // 500ms 待ってから実行（必要に応じて調整）
