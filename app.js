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
  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    if (!user) return show("s-login");
    $("who").textContent = user.displayName || user.email || "";
    loadMeanings();
    await loadStatus();
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
    if (!r.ok) throw Object.assign(new Error(j.error), { plain: j.plain });
    state.summary = j.summary;
    $("summary").textContent = j.summary;
    $("summary-box").hidden = false;
const catBox = j.category && document.querySelector(`input[name="category"][value="${j.category}"]`);
const filled = [];
if (catBox && !state.category) {
catBox.checked = true;
state.category = j.category;
markChecked($("category"));
$("fu-category").hidden = false;
filled.push("種類");
}
// 読めた商品名・価格は、記入の欄が空のときだけ入れる（あとで書き直せる）
if (j.name && !$("in-name").value.trim()) { $("in-name").value = j.name; $("fu-name").hidden = false; filled.push("名前"); }
if (j.price && !$("in-price").value.trim()) { $("in-price").value = j.price; $("fu-price").hidden = false; filled.push("価格"); }     // URLを読んだ人は「この要点に足したいこと」を聞く
    $("add-label").textContent = "この要点に足したいこと（任意）";
    $("in-add").placeholder = "";
$("url-status").textContent = filled.length
? "「URLから入れました」と出ている項目は、URLからAIが参照し、入力したものです。確認し、必要なら修正してください。"
: "要点を読みました。種類・名前・価格は入れていないので、ご自分で入れてください。";

  } catch (e) {
    $("url-status").textContent = e.plain ? e.message : "読めませんでした：" + e.message + "。種類を選んで進むこともできます。";
} finally {
$("btn-read-url").disabled = false;
}
};
$("in-name").addEventListener("input", () => ($("fu-name").hidden = true));
$("in-price").addEventListener("input", () => ($("fu-price").hidden = true));
$("category").addEventListener("change", () => ($("fu-category").hidden = true));


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
if (state.category === "当てはまるものがない") return show("s-refuse");

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
const c = state.card;
const clash = [];
if ((c[13] === "学生" && c[16] === "会社員") || (c[13] === "会社員" && c[16] === "学生")) clash.push("主人公と立場");
if (c[13] === "お年寄り" && ["10代", "20代", "30代", "40代"].includes(c[14])) clash.push("主人公と年齢層");
if (clash.length && !confirm(clash.join("・") + "が食い違っています。このまま進みますか？")) return;
$("card-error").textContent = "";

  // 今日の無料を使った人は、無料枠を押せない
  $("btn-free").disabled = state.usedFreeToday;
  $("free-used-note").hidden = !state.usedFreeToday;
  show("s-mode");
};

// ---- 有料枠を使いますか ----
$("btn-free").onclick = async () => {
  if (state.usedFreeToday) return;
  $("btn-free").disabled = true;
  try {
    const r = await callWorker("/prompt", { mode: "free", ...promptInput() });
    const j = await r.json();
    if (r.status === 429 && j.usedFree) {
      // 今日の無料はもう使っていた
      state.usedFreeToday = true;
      $("free-used-note").hidden = false;
      return;
    }
    if (!r.ok) throw new Error(j.error);
    state.usedFreeToday = true;
    $("prompt-out").value = j.prompt;
    $("caution-photo").hidden = !$("in-photo").files.length;
    $("caution-apply").textContent = CAUTION_APPLY[state.apply];
    // 使うたびの記録は、Workerがプロンプトを渡すときに残している
    show("s-free");
  } catch (e) {
    alertBox("s-mode", "プロンプトを作れませんでした：" + e.message);
  } finally {
    $("btn-free").disabled = state.usedFreeToday;
  }
};
$("btn-paid").onclick = () => show("s-paid"); // 準備中（4番）：決済へ
$("btn-copy-prompt").onclick = () => {
  navigator.clipboard.writeText($("prompt-out").value).then(() => ($("btn-copy-prompt").textContent = "コピーしました"));
};

// ---- Workerに頼む（プロンプトはWorkerで組み立てる。ここには置かない） ----
async function callWorker(path, body) {
  const token = await state.user.getIdToken();
  return fetch(WORKER_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(body),
  });
}

// 選んだものの意味は、ログインしたあとにWorkerから受け取って、画面に出す
async function loadMeanings() {
  try {
    const r = await callWorker("/meanings", {});
    const j = await r.json();
    if (r.ok) ITEMS.forEach((it) => { if (j.meanings[it.no]) it.meanings = j.meanings[it.no]; });
  } catch (e) { /* 受け取れなくても、意味が出ないだけで進める */ }
}


// 今日の無料を使ったか・前回のURL・前回の趣向カードを、Workerから受け取る
async function loadStatus() {
  try {
    const r = await callWorker("/status", {});
    const j = await r.json();
    if (!r.ok) return;
    state.usedFreeToday = j.usedFreeToday;
    state.lastUrl = j.lastUrl || "";
    state.prevCard = j.prevCard || {};
  } catch (e) { /* 受け取れなくても、無料枠のボタンでWorkerが確かめるので進める */ }
}

// プロンプトに入れる材料（お客さんが入れたもの）
function promptInput() {
  return {
    url: $("in-url").value.trim(),
    category: state.category,
    summary: state.summary,
    add: $("in-add").value,
    neta: $("in-neta").value,
    strength: $("in-strength").value,
    name: $("in-name").value,
    price: $("in-price").value,
    applyAd: APPLY[state.apply].ad,
    photo: $("in-photo").files.length > 0,
    age: $("in-age").value,
    sex: $("in-sex").value,
    stage: $("in-stage").value,
    card: state.card,
    savedCharacter: state.savedCharacter,
    prevOmakase: state.prevOmakase,
  };
}
// ---- 小さな道具 ----
function markChecked(box) {
  box.querySelectorAll(".chip").forEach((l) => l.classList.toggle("checked", l.querySelector("input").checked));
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}
