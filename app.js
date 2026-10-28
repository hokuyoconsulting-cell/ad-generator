// 広告生成機　画面の骨組み（作る順番の1番）
// まだ作っていない所には「準備中」と書いてある。
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { CATEGORIES, ITEMS, HUMAN, isAsked } from "./shukou.js";

const $ = (id) => document.getElementById(id);
const WORKER_URL = "https://ad-generator-worker.hokuyo-consulting.workers.dev"; 

// ---- 今の状態 ----
const state = {
  user: null,
  usedFreeToday: false,   // 準備中（3番）：Firebaseに残して読む
  lastUrl: "",            // 準備中（3番）：前回のURL
  prevCard: {},           // 準備中（3番）：前回の趣向カードの選択
  savedCharacter: null,   // 準備中（4番）：有料で残した主人公の特徴
  prevOmakase: "なし",    // 準備中（4番）：前回おまかせで選んだもの
  summary: "",            // 準備中（2番）：URLから読んだ要点
  category: "",
  card: {},
};

function show(id) {
  document.querySelectorAll(".screen").forEach((s) => (s.hidden = s.id !== id));
  window.scrollTo(0, 0);
}

// ---- ログイン ----
let auth = null;
if (firebaseConfig.apiKey === "ここに貼る") {
  $("btn-login").disabled = true;
  $("s-login").insertAdjacentHTML("beforeend",
    '<p class="error">Firebaseの設定の値が、まだ入っていません（js/firebase-config.js）。</p>');
} else {
  auth = getAuth(initializeApp(firebaseConfig));
  onAuthStateChanged(auth, (user) => {
    state.user = user;
    if (!user) return show("s-login");
    $("who").textContent = user.displayName || user.email || "";
    show(state.usedFreeToday ? "s-used" : "s-product");
    $("in-url").value = state.lastUrl;
  });
}
$("btn-login").onclick = () =>
  signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => alertBox("s-login", "ログインできませんでした：" + e.code));

function alertBox(screenId, msg) {
  $(screenId).insertAdjacentHTML("beforeend", `<p class="error">${msg}</p>`);
}

// ---- 今日の無料を使った人 ----
$("btn-use-paid").onclick = () => show("s-product");
$("btn-quit").onclick = () => show("s-bye");

// ---- 商品 ----
$("category").innerHTML = CATEGORIES.map((c) =>
  `<label class="chip"><input type="radio" name="category" value="${c}">${c}</label>`).join("");
$("category").onchange = (e) => {
  state.category = e.target.value;
  markChecked($("category"));
  if (state.category === "当てはまるものがない") show("s-refuse");
};

$("btn-read-url").onclick = async () => {
  const target = $("in-url").value.trim();
  if (!target) return ($("url-status").textContent = "URLを入れてください。");
  $("url-status").textContent = "読んでいます…（10秒ほどかかります）";
  $("btn-read-url").disabled = true;
  try {
    const token = await state.user.getIdToken();
    const r = await fetch(WORKER_URL + "/read-url", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ target }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    state.summary = j.summary;
    $("summary").textContent = j.summary;
    $("summary-box").hidden = false;
    if (j.category) {
      document.querySelector(`input[name="category"][value="${j.category}"]`).checked = true;
      state.category = j.category;
      markChecked($("category"));
    }
    // 読めた商品名・価格は、記入の欄が空のときだけ入れる（あとで書き直せる）
    if (j.name && !$("in-name").value.trim()) $("in-name").value = j.name;
    if (j.price && !$("in-price").value.trim()) $("in-price").value = j.price;
     // URLを読んだ人は「この要点に足したいこと」を聞く
    $("add-label").textContent = "この要点に足したいこと（任意）";
    $("in-add").placeholder = "";
    $("url-status").textContent = `読みました（名前：${j.name || "読めず"}／価格：${j.price || "読めず"}）。種類・名前・価格が合っているか確かめてください。`;

  } catch (e) {
    $("url-status").textContent = "読めませんでした：" + e.message + "。種類を選んで進むこともできます。";
  } finally {
    $("btn-read-url").disabled = false;
  }
};


  // ---- 申込方法 ----
  // 行き先は3つの媒体とも「プロフィールから」。プロフィールに載っているかを、作る人に確かめる
  const APPLY = {
    "プロフィールのリンクから": { ad: "お申し込みはプロフィールのリンクから",
      q: "TikTok・Instagram・Xのプロフィールに、申し込みページのリンクを載せていますか？", ok: "載せている（投稿までに載せる）" },
    "プロフィールの電話番号から": { ad: "ご予約はプロフィールの電話番号へ",
      q: "TikTok・Instagram・Xのプロフィールに、電話番号を載せていますか？", ok: "載せている（投稿までに載せる）" },
    "プロフィールの住所（お店）へ": { ad: "場所はプロフィールをご覧ください",
      q: "TikTok・Instagram・Xのプロフィールに、お店の住所を載せていますか？", ok: "載せている（投稿までに載せる）" },
    "DMで": { ad: "お申し込みはDMで",
      q: "TikTok・Instagram・Xで、DMを受け取れる設定になっていますか？", ok: "なっている（投稿までに設定する）" },
  };
  const CAUTION_APPLY = {
    "プロフィールのリンクから": "TikTok・Instagram・Xのプロフィールに、申し込みページのリンクを載せてください（本文には入れません）。",
    "プロフィールの電話番号から": "TikTok・Instagram・Xのプロフィールに、電話番号を載せてください。",
    "プロフィールの住所（お店）へ": "TikTok・Instagram・Xのプロフィールに、お店の住所を載せてください。",
    "DMで": "TikTok・Instagram・Xで、DMを受け取れる設定にしてください。",
  };
  $("apply").innerHTML = Object.keys(APPLY).map((k) =>
    `<label class="chip"><input type="radio" name="apply" value="${k}">${k}</label>`).join("");
  $("apply").onchange = (e) => {
    state.apply = e.target.value;
    markChecked($("apply"));
    $("apply-confirm-box").hidden = false;
    $("apply-question").textContent = APPLY[state.apply].q;
    $("apply-confirm-text").textContent = APPLY[state.apply].ok;
    $("apply-confirm").checked = false;
  };

// ---- 記入 ----
$("btn-input-next").onclick = () => {
  const need = [["in-strength", "伝えたい強み"], ["in-name", "商品・サービスの名前"], ["in-price", "価格"],
    ["in-age", "年齢層"], ["in-sex", "性別"], ["in-stage", "ライフステージ"]];
  const empty = need.filter(([id]) => !$(id).value.trim()).map(([, n]) => n);
  if (!state.apply) empty.push("申込方法");
  if (!state.category) empty.unshift("商品の種類");

  if (empty.length) return ($("input-error").textContent = "まだ入っていません：" + empty.join("・"));
  if (!$("apply-confirm").checked) return ($("input-error").textContent = "申込方法の情報をプロフィールに載せてから使ってください。");
  $("input-error").textContent = "";
  // 前回の選択を最初から入れておく（印も付ける）
  state.card = { ...state.prevCard };
  if (!state.card[19]) state.card[19] = "特になし";
  renderCard();
  show("s-card");
};

// ---- 趣向カード ----
function renderCard() {
  const has = !!state.savedCharacter;
  // 聞かなくなった項目の答えは消す
  ITEMS.forEach((it) => { if (!isAsked(it.no, state.card, has)) delete state.card[it.no]; });
  $("card").innerHTML = ITEMS.filter((it) => isAsked(it.no, state.card, has)).map(itemHtml).join("");
}

function itemHtml(it) {
  const prev = state.prevCard[it.no];
  const isPrev = (o) => (Array.isArray(prev) ? prev.includes(o) : prev === o);
  let body = "";
  if (it.type === "text") {
    body = `<input data-no="${it.no}" value="${esc(state.card[it.no] || "")}" placeholder="${it.placeholder || ""}">`;
  } else {
    const t = it.type === "multi" ? "checkbox" : "radio";
    const cur = state.card[it.no];
    body = '<div class="choices">' + it.options.map((o) => {
      const on = Array.isArray(cur) ? cur.includes(o) : cur === o;
      return `<label class="chip${on ? " checked" : ""}"><input type="${t}" name="i${it.no}" data-no="${it.no}" value="${o}"${on ? " checked" : ""}>${o}${isPrev(o) ? '<span class="prev-mark">前回</span>' : ""}</label>`;
    }).join("") + "</div>";
  }
  const meaning = currentMeaning(it);
  return `<div class="item"><div><span class="group">${it.group}</span><span class="name">${it.no}. ${it.name}</span>${it.type === "multi" ? '<span class="note">（いくつでも）</span>' : ""}</div>${body}${meaning ? `<div class="meaning">${meaning}</div>` : ""}</div>`;
}

// 選んでいるものの意味・注意を、項目の下に出す（選択肢の例の代わり。例の見せ方は画面の作りで決める）
function currentMeaning(it) {
  const v = state.card[it.no];
  const list = Array.isArray(v) ? v : v ? [v] : [];
  const parts = list.map((o) => (it.meanings && it.meanings[o] ? `${o}：${it.meanings[o]}` : "")).filter(Boolean);
  if (it.screenNote) list.forEach((o) => it.screenNote[o] && parts.push(`※${it.screenNote[o]}`));
  if (it.hint) parts.push(it.hint);
  return parts.join("<br>");
}

$("card").onchange = $("card").oninput = (e) => {
  const no = Number(e.target.dataset.no);
  if (!no) return;
  const it = ITEMS.find((x) => x.no === no);
  if (it.type === "multi") {
    state.card[no] = [...document.querySelectorAll(`input[name="i${no}"]:checked`)].map((x) => x.value);
  } else {
    state.card[no] = e.target.value;
  }
  if (e.type === "change") renderCard(); // 12・13は、ほかの項目の出る出ないを変える
};

$("btn-card-next").onclick = () => {
  const has = !!state.savedCharacter;
  const missing = ITEMS.filter((it) => isAsked(it.no, state.card, has)).filter((it) => {
    const v = state.card[it.no];
    return Array.isArray(v) ? v.length === 0 : !v || !String(v).trim();
  }).map((it) => it.no);
  if (missing.length) return ($("card-error").textContent = "まだ選んでいない項目：" + missing.join("・"));
  $("card-error").textContent = "";
  // 今日の無料を使った人は、無料枠を押せない
  $("btn-free").disabled = state.usedFreeToday;
  $("free-used-note").hidden = !state.usedFreeToday;
  show("s-mode");
};

// ---- 有料枠を使いますか ----
$("btn-free").onclick = async () => {
  if (state.usedFreeToday) return;
  $("prompt-out").value = await buildPrompt("free");
  $("caution-photo").hidden = !$("in-photo").files.length;
  $("caution-apply").textContent = CAUTION_APPLY[state.apply];
  // 準備中（3番）：ここで「今日の無料を使った」と使うたびの記録をFirebaseに残す
  show("s-free");
};
$("btn-paid").onclick = () => show("s-paid"); // 準備中（4番）：決済へ
$("btn-copy-prompt").onclick = () => {
  navigator.clipboard.writeText($("prompt-out").value).then(() => ($("btn-copy-prompt").textContent = "コピーしました"));
};

// ---- プロンプトを組み立てる ----
const LINE = "────────────────";
const head = (t) => `${LINE}\n${t}\n${LINE}`;
const val = (id) => $(id).value.trim() || "なし";

async function loadText(path) {
  const r = await fetch(path, { cache: "no-cache" });
  return r.text();
}

async function buildPrompt(mode) {
  const body = await loadText("body.txt");
  const tail = await loadText(mode === "free" ? "free.txt" : "paid.txt");
  return body
    .replace("{{商品の情報}}", productBlock())
    .replace("{{見てほしい人}}", targetBlock())
    .replace("{{趣向カードの答え}}", cardBlock())
    .trimEnd() + "\n\n" + tail;
}

function productBlock() {
  const photo = $("in-photo").files.length ? "写真あり" : "写真なし";
  return [
    head("1. 商品の情報"),
    `・種類：${state.category}`,
    ...(state.summary
      ? [`・商品の要点：${state.summary}`, `・要点への付け足し：${val("in-add")}`]
      : [`・商品の説明：${val("in-add")}`]),
    `・今回のネタ：${val("in-neta")}`,
    `・今回の広告で伝えたい強み：${val("in-strength")}`,
    "　→ この広告で伝える強みは、これ1つだけにしてください。",
    `・名称：${val("in-name")}`,
    `・価格：${val("in-price")}`,
    `・申込方法：${APPLY[state.apply].ad}`,
    "　→ 名称・価格・申込方法は、どの文にも必ず入れてください。書かれたとおりに書き、言いかえないでください。",
    `・商品の写真：${photo}`,
    "　→ 写真は、商品の見た目を知るための資料です。広告の中に写真そのものを貼らないでください。",
    // 準備中：色で「商品やお店の色に合わせる」を選んだときの「商品やお店の色」の行
  ].join("\n");
}

function targetBlock() {
  return [head("2. 見てほしい人"),
    `・個人向け／年齢層：${$("in-age").value}／性別：${$("in-sex").value}／ライフステージ：${val("in-stage")}`].join("\n");
}

function answer(no) {
  const it = ITEMS.find((x) => x.no === no);
  const v = state.card[no];
  const list = Array.isArray(v) ? v : [v];
  const lines = [`・${it.name}：${list.join("、")}`];
  if (it.meanings) list.forEach((o) => it.meanings[o] && lines.push(`　${list.length > 1 ? o + "：" : ""}${it.meanings[o]}`));
  if (it.promptNote) lines.push(`　${it.promptNote}`);
  return lines.join("\n");
}

function cardBlock() {
  const c = state.card;
  const has = !!state.savedCharacter;
  const out = [head("3. 趣向カードの答え（お客さんが選んだもの）")];
  out.push("【話】", answer(1), answer(2), answer(3));
  if (c[2] === "オチなし" && c[3] === "3コマ目で落として4コマ目で商品の一言") out.push("　3コマ目は、笑わせずに小さく落としてください。");
  if (c[2] === "オチなし" && c[3] === "毎コマに小ネタ") out.push("　4コマ目も、1〜3コマ目と同じ大きさにしてください。");
  out.push("", "【文】", answer(4), answer(5), answer(6), answer(7));
  // 色：「商品やお店の色に合わせる」で色が取れないときは「絵柄に任せる」と同じ（色の取り出しは準備中）
  const color = c[9] === "商品やお店の色に合わせる" ? "絵柄に任せる" : c[9];
  out.push("", "【絵】", answer(8), `・色：${color}`, answer(10), answer(11));
  out.push("", "【主人公】");
  if (has && c[12] === "前回と同じ") {
    out.push(`・主人公：前回と同じ。前回の主人公の特徴：${state.savedCharacter}`, "　→ この特徴のとおりに描いてください。");
  } else {
    out.push(`・主人公：${c[13]}`);
    if (HUMAN.includes(c[13])) out.push(`・年齢層：${c[14]}／性別：${c[15]}／立場：${c[16]}`);
  }
  out.push(answer(17));
  out.push("", "【届け先】", answer(18));
  out.push("", "【決まり】", answer(19));
  out.push("", "【商品】", answer(20));
  out.push("", "【「おまかせ」の項目】",
    "・「おまかせ」になっている項目は、商品と見てほしい人に合うものを、あなたが選んでください。",
    `・前回あなたが選んだもの（${state.prevOmakase}）と同じものは、なるべく避けてください。`);
  return out.join("\n");
}

// ---- 小さな道具 ----
function markChecked(box) {
  box.querySelectorAll(".chip").forEach((l) => l.classList.toggle("checked", l.querySelector("input").checked));
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}
