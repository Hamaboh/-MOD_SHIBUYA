# 更新手順（Claude 用ランブック）

このリポジトリは **Claude（Cowork）が Brave / Chrome 拡張経由で GitHub Web UI にコミットする**前提で運用する。
git push は使えない（セッションの git プロキシがこのリポジトリへの書き込みを許可しないため）。読み取り（clone / curl raw）は可能。

> **2026/9/11 改訂。** 旧版は「タブが最前面でなければスキップ」としていたが、
> **背面タブ（`visibilityState === "hidden"`）でも収集できる方法が確立したので、スキップしない。**
> 生成もブラウザではなくコンテナ側（node）で行う。以下が現行手順。

## 前提条件

1. Brave（Claude in Chrome 拡張）が起動していること。**最前面である必要はない。**
2. 拡張のサイト権限で `x.com` と `github.com` が許可されていること。
3. X（x.com）にログイン済みであること。

## 背面タブでの制約（重要）

| 事象 | 実態 | 対処 |
|---|---|---|
| 無限スクロール | `hidden` だと追加レンダリングが一切起きない（スクロール自体は動く） | スクロールを使わず、**時間窓を狭めた検索を撃ち直す**（後述） |
| `setTimeout` | 数分後に「1分に1回」まで throttle される | **Worker 内でスリープ**する |
| `javascript_tool` の戻り値 | 約1000文字で truncate。base64 や長い JSON は `[BLOCKED]` になる | データ取り出しは **DOM に書いて `get_page_text`** |
| GraphQL API 直叩き | `x-client-transaction-id` 不足で 404 | 使わない |
| github.com 上の `eval` | CSP で禁止 | **生成はコンテナ側の node で行う** |

## 手順

### 1. 既存データの取得

```
curl -s https://raw.githubusercontent.com/Hamaboh/-MOD_SHIBUYA/main/posts.json > posts.json
curl -s https://raw.githubusercontent.com/Hamaboh/-MOD_SHIBUYA/main/topics.json > topics.json
curl -s https://raw.githubusercontent.com/Hamaboh/-MOD_SHIBUYA/main/generator.js > generator.js
```

`posts.json` の最新 `t`（UTC）が前回の収集到達点。その数分前を `from` にする。

### 2. X から新規投稿を収集（時間窓リプレイ方式）

タブを検索URLで一度開く。以降は**フルロードせず `pushState` + `popstate` で検索し直す**と、
背面タブでもその窓の先頭 1〜20 件がレンダリングされる。これを時間窓を刻んで繰り返す。

注入①（スリープと収集）:

```js
window.__wsrc=URL.createObjectURL(new Blob(["onmessage=e=>{const t=Date.now()+e.data;while(Date.now()<t){};postMessage(1)}"],{type:'text/javascript'}));
window.__sl=ms=>new Promise(r=>{const w=new Worker(window.__wsrc);w.onmessage=()=>{w.terminate();r()};w.postMessage(ms)});
window.__acc={};
window.__grab=function(){const acc=window.__acc;let n=0;
 document.querySelectorAll('article[data-testid="tweet"]').forEach(a=>{
  const t=a.querySelector('time'); if(!t)return;
  const link=t.closest('a'); const href=link?link.getAttribute('href'):null;
  if(!href||!href.includes('/status/'))return;
  const id=href.split('/status/')[1].split('/')[0]; if(!id)return;
  const handle=href.split('/')[1];
  const nameEl=a.querySelector('div[data-testid="User-Name"]');
  const txtEl=a.querySelector('div[data-testid="tweetText"]');
  const imgs=[...a.querySelectorAll('img[src*="/media/"]')].length;
  const vid=a.querySelector('div[data-testid="videoPlayer"]')?1:0;
  const qt=a.querySelector('div[role="link"] div[data-testid="tweetText"]');
  if(!acc[id]){acc[id]={id,u:'https://x.com/'+handle+'/status/'+id,h:'@'+handle,
    n:nameEl?nameEl.innerText.split('\n')[0]:'',t:t.getAttribute('datetime'),
    x:txtEl?txtEl.innerText:'',q:qt?qt.innerText:'',m:imgs,v:vid};n++;}});
 return n;};
```

注入②（窓の実行とクロール）:

```js
window.__win=async function(from,to,wait){
 const q='#MOD_SHIBUYA since_time:'+from+' until_time:'+to;
 history.pushState({},'','/search?q='+encodeURIComponent(q)+'&f=live');
 window.dispatchEvent(new PopStateEvent('popstate',{state:{}}));
 await window.__sl(wait||4000);
 const n=window.__grab();
 const a=[...document.querySelectorAll('article[data-testid="tweet"]')].map(e=>e.querySelector('time')).filter(Boolean).map(e=>e.getAttribute('datetime')).sort();
 return {n,shown:a.length,oldest:a[0]||null};};
window.__log=[];
window.__crawl=async function(from,to,depth){
 const r=await window.__win(from,to,4000);
 window.__log.push({f:from,t:to,d:depth,s:r.shown,n:r.n});
 if(r.shown>=8&&depth<7&&r.oldest){                 // 1ページ分しか出ていない疑い
  const ot=Math.floor(new Date(r.oldest).getTime()/1000);
  if(ot-20>from){await window.__crawl(from,ot+1,depth+1);}}};  // 残りの古い側を再取得
window.__prog={i:0,tot:0,done:false};
window.__runAll=async function(start,end,step){
 const ch=[];for(let a=start;a<end;a+=step)ch.push([a,Math.min(a+step,end)]);
 window.__prog={i:0,tot:ch.length,done:false};
 for(const c of ch){try{await window.__crawl(c[0],c[1],0)}catch(e){window.__log.push({err:''+e})};window.__prog.i++;}
 window.__prog.done=true;return Object.keys(window.__acc).length;};
window.__p=window.__runAll(<from>,<to>,1800);   // 30分刻み
```

進捗は `JSON.stringify({prog:window.__prog,tot:Object.keys(window.__acc).length})` で確認。
**検証パス**として `step=600`（10分刻み）でもう一度 `__runAll` を回し、`n` が全部 0 なら取りこぼしなし。
ページ読み込みが間に合わず `shown:0` が並ぶことがある。その区間は `wait` を 6500 に上げて撃ち直す。

### 3. データの取り出し（x.com → コンテナ）

`javascript_tool` の戻り値では取り出せないので、**DOM に書いて `get_page_text` で読む**。
`get_page_text` は空白を正規化するため、空白・改行はセンチネルに置換してから書き出す。

```js
const esc=s=>String(s==null?'':s).replace(/\r/g,'').replace(/\n/g,'⏎').replace(/\t/g,'␉').replace(/　/g,'␣').replace(/ /g,'␠');
const v=Object.values(window.__acc).sort((a,b)=>a.t<b.t?-1:1);
window.__txt=v.map(p=>[p.id,p.t,p.h,esc(p.n),p.m,p.v,esc(p.x),esc(p.q)].join('¦')).join('§\n');
document.documentElement.innerHTML='<head><title>d</title></head><body><article id="d"></article></body>';
document.getElementById('d').textContent=window.__txt;
```

その後 `get_page_text` で全文を取得し、コンテナ側で `§` 分割 → `¦` 分割 → センチネル復元。
`u` は `'https://x.com/'+h.slice(1)+'/status/'+id` で再構成できる。

### 4. topics の追記

新しい日・新しい時間帯の分は、収集した投稿を読んで書き起こす。
既存トピックに追記する場合は `points` と `refs` を足す。`refs` は `posts[].id` の完全一致。

**新しい出演者・参加アーティスト・協力企業が出てきたら `generator.js` の `OFF` セットに追加する**
（OFF に入っているアカウントは全文掲載、それ以外は110文字超で80文字抜粋）。

### 5. index.html の生成（コンテナ側 node）

`generator.js` は `window` に生える UMD もどきなので、node では次のように読む。

```js
global.window={};
require('./generator.js');
const html=window.MOD.generate(posts, topics, meta);
```

`meta` は `{updated:'YYYY/MM/DD HH:MM', coverage:'... JST', posts:件数, policy:'...'}`（JST 表記）。
JSON は `JSON.stringify(x,null,1)` 相当（python なら `indent=1`）でリポジトリの体裁に合わせる。

### 6. コミット（file_upload）

**`DataTransfer` も `postMessage` も不要。** 生成物を `/mnt/user-data/outputs/` に置き、
`https://github.com/Hamaboh/-MOD_SHIBUYA/upload/main` を開いて
`find`（"file input"）→ `mcp__claude-in-chrome__file_upload` に**コンテナの絶対パス**を渡す。
1回あたり合計 10MB まで。

コミットメッセージは React 制御下なので**ネイティブ setter 経由**で入れる。

```js
const nat=(el,v)=>{Object.getOwnPropertyDescriptor(el.constructor.prototype,'value').set.call(el,v);
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
nat(document.querySelector('input[name="message"]'),'...');
```

その後 `Commit changes`（`button.js-blob-submit`）を `.click()`。
ページ遷移するので、同じ注入内で長い `await` を置かないこと。

### 7. 検証

`git clone --depth 1` して `git ls-tree -r --long HEAD` でコミット内容を確認（raw は数分キャッシュされる）。
そのうえで Pages を確認（反映に1分前後）。

```
curl -s -L https://hamaboh.github.io/-MOD_SHIBUYA/ > live.html
grep -o 'x.com/[A-Za-z0-9_]*/status/' live.html | wc -l   # = 投稿件数
grep -o '抜粋' live.html | wc -l
grep -o 'DAY [0-9]' live.html | sort -u
grep -c '掲載方針' live.html; grep -c 'Hamaboh/-MOD_SHIBUYA/issues' live.html
```

## 掲載方針（厳守）

- ページの主役は編集者がまとめた「トピック」段落。
- 主催者・出演者・参加アーティスト・協力企業の告知投稿は全文掲載（`generator.js` の `OFF`）。
- それ以外の一般投稿は、110文字超のときだけ冒頭80文字の抜粋＋「抜粋」バッジ。引用ブロックは出さない。
- 画像・動画は転載しない（`画像 N` バッジのみ）。
- 概要欄の「掲載方針」ブロックとフッターの削除依頼窓口（GitHub Issue）は必ず残す。

以上は `generator.js` に実装済みなので、**generator.js を使えば自動的に守られる。**

## 収集スケジュール

毎日 **09:00 / 18:00 / 24:00（JST）**、**2026年9月14日(月) 09:00 で終了**。
**タブが背面でもスキップしない。** 前提条件が揃わず失敗した場合のみ次回にまとめて収集する。
